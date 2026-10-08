"use client";
// Gestion d'un film : Responsable, co-gestionnaires, demandes, invitations, transfert.
// Charge a l'ouverture (GET /api/projects/[id]/managers).
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Note, SectionLabel } from "./parts";
import { callApi, type ShowToast } from "./api";

interface Person {
  profile_id: string;
  full_name: string | null;
  slug: string | null;
}

interface ManagersData {
  my_role: "owner" | "manager";
  owner: { id: string; full_name: string | null } | null;
  managers: Person[];
  requests: (Person & { id: string; kind: "invite" | "request"; can_cancel: boolean })[];
  candidates: Person[];
}

const nameOf = (p: { full_name: string | null } | null | undefined) => p?.full_name || "Membre";
const rowCls = "flex flex-wrap items-center justify-between gap-2";
const nameCls = "min-w-0 flex-1 truncate text-sm text-text-primary";
const metaCls = "text-xs leading-relaxed text-text-secondary";

export default function FilmManagers({
  projectId,
  userId,
  reloadFilms,
  showToast,
}: {
  projectId: string;
  userId: string;
  reloadFilms: () => Promise<void>;
  showToast: ShowToast;
}) {
  const [data, setData] = useState<ManagersData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const url = `/api/projects/${projectId}/managers`;

  const load = useCallback(
    () =>
      callApi<ManagersData>(url).then((r) => {
        if (r.ok) setData(r.data);
        else setError(r.error);
      }),
    [url]
  );

  useEffect(() => {
    load();
  }, [load]);

  // films : l'action change la liste des films ou mon role (retrait de soi, transfert).
  async function act(run: () => ReturnType<typeof callApi>, okText: string, films = false) {
    setBusy(true);
    setError("");
    const r = await run();
    if (r.ok) {
      showToast(okText);
      await (films ? Promise.all([load(), reloadFilms()]) : load());
    } else {
      setError(r.error);
    }
    setBusy(false);
  }

  if (!data) {
    return error ? <Note>{error}</Note> : <p className={metaCls}>Chargement...</p>;
  }

  const isOwner = data.my_role === "owner";
  const pendingIds = new Set(data.requests.map((r) => r.profile_id));
  const invitable = data.candidates.filter((c) => !pendingIds.has(c.profile_id));
  const transferTarget = data.managers.find((m) => m.profile_id === transferTo);

  return (
    <div className="flex flex-col gap-4">
      {/* Responsable */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Responsable</SectionLabel>
        <p className="text-sm text-text-primary">
          {data.owner ? `${nameOf(data.owner)}${data.owner.id === userId ? " (toi)" : ""}` : "Ce film n'a plus de Responsable."}
        </p>
      </div>

      {/* Co-gestionnaires */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Co-gestionnaires</SectionLabel>
        {data.managers.length === 0 && <p className={metaCls}>Aucun co-gestionnaire.</p>}
        {data.managers.map((m) => {
          const isMe = m.profile_id === userId;
          return (
            <div key={m.profile_id} className={rowCls}>
              <p className={nameCls}>{nameOf(m)}{isMe ? " (toi)" : ""}</p>
              {(isOwner || isMe) && (
                <Button
                  variant="glass"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(isMe ? "Quitter la co-gestion de ce film ?" : `Retirer ${nameOf(m)} de la co-gestion ?`)) return;
                    act(
                      () => callApi(`${url}?profile_id=${m.profile_id}`, "DELETE"),
                      isMe ? "Tu ne co-gères plus ce film" : "Co-gestionnaire retiré",
                      isMe
                    );
                  }}
                  className="shrink-0"
                >
                  {isMe ? "Me retirer" : "Retirer"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Demandes et invitations en attente */}
      {data.requests.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>En attente</SectionLabel>
          {data.requests.map((r) => (
            <div key={r.id} className={rowCls}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">{nameOf(r)}</p>
                <p className={metaCls}>{r.kind === "invite" ? "Invitation à co-gérer envoyée" : "Demande à co-gérer"}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {isOwner && r.kind === "request" && (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => act(() => callApi(url, "PATCH", { request_id: r.id, accept: true }), "Demande acceptée")}>
                      Accepter
                    </Button>
                    <Button variant="glass" size="sm" disabled={busy} onClick={() => act(() => callApi(url, "PATCH", { request_id: r.id, accept: false }), "Demande refusée")}>
                      Refuser
                    </Button>
                  </>
                )}
                {r.can_cancel && (
                  <Button variant="glass" size="sm" disabled={busy} onClick={() => act(() => callApi(`${url}?request_id=${r.id}`, "DELETE"), "Demande annulée")}>
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inviter une personne creditee (Responsable) */}
      {isOwner && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Inviter à co-gérer</SectionLabel>
          {invitable.length === 0 ? (
            <p className={metaCls}>Seules les personnes créditées sur le film, inscrites sur Unkast, peuvent être invitées.</p>
          ) : (
            invitable.map((c) => (
              <div key={c.profile_id} className={rowCls}>
                <p className={nameCls}>{nameOf(c)}</p>
                <Button variant="glass" size="sm" disabled={busy} onClick={() => act(() => callApi(url, "POST", { profile_id: c.profile_id }), "Invitation envoyée")} className="shrink-0">
                  Inviter
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transfert (Responsable) */}
      {isOwner && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Transférer le film</SectionLabel>
          {data.managers.length === 0 ? (
            <p className={metaCls}>Le film ne peut être transféré qu&apos;à un co-gestionnaire. Invite d&apos;abord quelqu&apos;un à co-gérer.</p>
          ) : (
            <>
              <Select
                aria-label="Nouveau Responsable"
                value={transferTo}
                onChange={(e) => { setTransferTo(e.target.value); setConfirmTransfer(false); }}
              >
                <option value="">Choisis un co-gestionnaire</option>
                {data.managers.map((m) => (
                  <option key={m.profile_id} value={m.profile_id}>{nameOf(m)}</option>
                ))}
              </Select>
              {transferTarget && !confirmTransfer && (
                <Button variant="glass" onClick={() => setConfirmTransfer(true)} className="self-start">
                  Transférer
                </Button>
              )}
              {transferTarget && confirmTransfer && (
                <div className="flex flex-col gap-3 rounded-card border border-orange-400/30 bg-orange-400/10 p-3">
                  <p className="text-xs leading-relaxed text-text-primary">
                    {nameOf(transferTarget)} devient Responsable du film. Tu deviens co-gestionnaire : tu ne pourras plus le supprimer, changer sa visibilité ni le transférer.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        await act(() => callApi(`/api/projects/${projectId}/transfer`, "POST", { profile_id: transferTarget.profile_id }), "Film transféré", true);
                        setConfirmTransfer(false);
                      }}
                    >
                      Confirmer le transfert
                    </Button>
                    <Button variant="glass" size="sm" disabled={busy} onClick={() => setConfirmTransfer(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && <Note>{error}</Note>}
    </div>
  );
}
