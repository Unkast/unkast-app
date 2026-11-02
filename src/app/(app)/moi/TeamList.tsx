"use client";
// Equipe d'un film dans l'onglet « Créditer » : membres confirmes, invitations en
// attente, credits sans compte (GET /api/projects/[id]/credits). Une carte par
// personne (regroupement par identifiant de profil), une ligne par role avec son etat
// et ses actions. Les credits sans compte (par email) ne sont pas regroupes : rien ne
// dit que deux credits du meme nom sont la meme personne.
// Les actions affichees suivent les droits (is_owner, me) ; chaque route les controle
// de nouveau.
//  - Modifier le role : Responsable et co-gestionnaires.
//  - Retirer : Responsable seul. Chacun peut se retirer lui-meme.
//  - Invitation membre en attente : annulable par le Responsable ou son auteur.
//  - Invitation par email : renvoyer (3 fois au plus), annuler (Responsable ou auteur).
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import CreditRolesField from "@/components/CreditRolesField";
import { splitRoles } from "@/lib/credits";
import { callApi, type ShowToast } from "./api";

type EmailInvite = { id: string; inviter_id: string | null; state: "pending" | "expired"; resend_count: number };

type TeamRow =
  | { kind: "member"; credit_id: string; profile_id: string; name: string; avatar_url: string | null; role: string }
  | { kind: "ghost"; credit_id: string; name: string; avatar_url: null; role: string; invitation: EmailInvite | null }
  | { kind: "invited"; invitation_id: string; profile_id: string; inviter_id: string; name: string; avatar_url: string | null; role: string };

interface TeamData {
  is_owner: boolean;
  me: string;
  team: TeamRow[];
}

// Une personne et ses roles.
interface Person {
  key: string;
  profileId: string | null;
  name: string;
  avatar_url: string | null;
  rows: TeamRow[];
}

const MAX_RESENDS = 3;

function rowKey(row: TeamRow) {
  return row.kind === "invited" ? `i-${row.invitation_id}` : `c-${row.credit_id}`;
}

// Regroupe par identifiant de profil, dans l'ordre d'apparition (la route envoie les
// credits d'abord, puis les invitations). Un credit sans compte forme sa propre carte.
function groupByPerson(team: TeamRow[]): Person[] {
  const people: Person[] = [];
  const byProfile = new Map<string, Person>();
  for (const row of team) {
    if (row.kind === "ghost") {
      people.push({ key: rowKey(row), profileId: null, name: row.name, avatar_url: null, rows: [row] });
      continue;
    }
    const known = byProfile.get(row.profile_id);
    if (known) {
      known.rows.push(row);
      continue;
    }
    const person: Person = { key: `p-${row.profile_id}`, profileId: row.profile_id, name: row.name, avatar_url: row.avatar_url, rows: [row] };
    byProfile.set(row.profile_id, person);
    people.push(person);
  }
  return people;
}

function StateBadge({ row }: { row: TeamRow }) {
  if (row.kind === "member") return <Badge variant="published">Confirmé</Badge>;
  if (row.kind === "invited") return <Badge variant="pending">En attente</Badge>;
  return (
    <Badge variant="neutral">
      Sans compte
      {row.invitation?.state === "pending" && " · invitation envoyée"}
      {row.invitation?.state === "expired" && " · invitation expirée"}
    </Badge>
  );
}

export default function TeamList({ projectId, showToast }: { projectId: string; showToast: ShowToast }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Action en attente de confirmation (fenetre ConfirmDialog).
  const [confirming, setConfirming] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    run: () => Promise<{ ok: boolean; error: string }>;
    success: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    callApi<TeamData>(`/api/projects/${projectId}/credits`).then((r) => {
      if (cancelled) return;
      if (r.ok) setData(r.data);
      else setError(r.error);
    });
    return () => { cancelled = true; };
  }, [projectId, version]);

  const refresh = () => setVersion((v) => v + 1);

  // Lance une action, affiche son message, puis relit l'equipe.
  async function act(request: Promise<{ ok: boolean; error: string }>, success: string) {
    setBusy(true);
    const r = await request;
    setBusy(false);
    showToast(r.ok ? success : r.error);
    if (r.ok) {
      setEditing(null);
      refresh();
    }
  }

  if (!data) {
    return error ? <p className="text-xs text-red-400">{error}</p> : <p className="text-xs text-text-secondary">Chargement de l&apos;équipe…</p>;
  }

  const { is_owner: isOwner, me, team } = data;
  const people = groupByPerson(team);

  return (
    <section className="border-t border-white/10 pt-4">
      <h4 className="mb-2 text-[13px] font-semibold text-text-primary">Équipe du film</h4>
      {people.length === 0 ? (
        <p className="text-xs text-text-secondary">Personne n&apos;est encore crédité sur ce film.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2 lg:items-start">
          {people.map((person) => {
            const isMe = person.profileId === me;
            const several = person.rows.length > 1;
            return (
              <li key={person.key} className="flex flex-col gap-3 rounded-card border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-3">
                  <Avatar url={person.avatar_url} name={person.name} size={36} className="shrink-0" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{person.name}{isMe && " (toi)"}</p>
                </div>

                <div className="flex flex-col gap-3">
                  {person.rows.map((row) => {
                    const key = rowKey(row);
                    const isCredit = row.kind !== "invited";
                    const roleLabel = `« ${row.role} »`;
                    return (
                      <div key={key} className="flex flex-col gap-2 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-sm text-text-primary">{row.role}</p>
                          <span className="shrink-0">
                            <StateBadge row={row} />
                          </span>
                        </div>

                        {editing === key && isCredit ? (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="sm:flex-1">
                              <CreditRolesField value={editRoles} onChange={setEditRoles} placeholder="Rôles" />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={busy || editRoles.length === 0}
                                onClick={() => act(callApi(`/api/projects/${projectId}/credits/${row.credit_id}`, "PATCH", { roles: editRoles }), "Rôle modifié")}
                              >
                                Enregistrer
                              </Button>
                              <Button variant="glass" size="sm" disabled={busy} onClick={() => setEditing(null)}>
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {isCredit && (
                              <Button variant="glass" size="sm" disabled={busy} onClick={() => { setEditing(key); setEditRoles(splitRoles(row.role)); }}>
                                Modifier le rôle
                              </Button>
                            )}

                            {/* Retirer : Responsable pour tous ; soi-meme par la route existante. */}
                            {isCredit && isOwner && (
                              <Button
                                variant="glass"
                                size="sm"
                                disabled={busy}
                                className="text-red-400!"
                                onClick={() => setConfirming({
                                  title: isMe
                                    ? several ? `Retirer ton rôle ${roleLabel} ?` : "Te retirer de l'équipe ?"
                                    : several ? `Retirer le rôle ${roleLabel} de ${person.name} ?` : `Retirer ${person.name} de l'équipe ?`,
                                  description: isMe
                                    ? several
                                      ? "Ce rôle disparaîtra du générique du film. Tes autres rôles restent."
                                      : "Ton crédit disparaîtra du générique du film."
                                    : several
                                      ? `Ce rôle disparaît du générique du film. Les autres rôles de ${person.name} restent.`
                                      : "Son crédit disparaît du générique du film. Tu pourras le recréditer plus tard.",
                                  confirmLabel: "Retirer",
                                  run: () => callApi(`/api/projects/${projectId}/credits/${row.credit_id}`, "DELETE"),
                                  success: several ? "Rôle retiré" : "Retiré de l'équipe",
                                })}
                              >
                                Retirer
                              </Button>
                            )}
                            {isMe && !isOwner && row.kind === "member" && (
                              <Button
                                variant="glass"
                                size="sm"
                                disabled={busy}
                                className="text-red-400!"
                                onClick={() => setConfirming({
                                  title: several ? `Retirer ton rôle ${roleLabel} ?` : "Te retirer de l'équipe ?",
                                  description: several
                                    ? "Ce rôle disparaîtra du générique du film. Tes autres rôles restent."
                                    : "Ton crédit disparaîtra du générique du film.",
                                  confirmLabel: "Me retirer",
                                  run: () => callApi(`/api/dashboard/credits?id=${row.credit_id}`, "DELETE"),
                                  success: several ? "Rôle retiré" : "Tu as été retiré de l'équipe",
                                })}
                              >
                                Me retirer
                              </Button>
                            )}

                            {/* Invitation a un membre, en attente */}
                            {row.kind === "invited" && (isOwner || row.inviter_id === me) && (
                              <Button
                                variant="glass"
                                size="sm"
                                disabled={busy}
                                onClick={() => setConfirming({
                                  title: several ? `Annuler l'invitation au rôle ${roleLabel} ?` : `Annuler l'invitation de ${person.name} ?`,
                                  description: "Elle ne pourra plus accepter ce crédit. Tu pourras l'inviter de nouveau plus tard.",
                                  confirmLabel: "Annuler l'invitation",
                                  run: () => callApi(`/api/invitations/project/${row.invitation_id}`, "DELETE"),
                                  success: "Invitation annulée",
                                })}
                              >
                                Annuler l&apos;invitation
                              </Button>
                            )}

                            {/* Invitation par email d'un credit sans compte */}
                            {row.kind === "ghost" && row.invitation && (
                              <>
                                {row.invitation.resend_count < MAX_RESENDS && (
                                  <Button
                                    variant="glass"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => act(callApi(`/api/invitations/${row.invitation!.id}/resend`, "POST"), "Invitation renvoyée")}
                                  >
                                    Renvoyer ({MAX_RESENDS - row.invitation.resend_count} restant{MAX_RESENDS - row.invitation.resend_count > 1 ? "s" : ""})
                                  </Button>
                                )}
                                {(isOwner || row.invitation.inviter_id === me) && (
                                  <Button
                                    variant="glass"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => setConfirming({
                                      title: `Annuler l'invitation de ${person.name} ?`,
                                      description: "Le lien reçu par email ne fonctionnera plus. Son crédit reste dans l'équipe jusqu'à ce que tu le retires.",
                                      confirmLabel: "Annuler l'invitation",
                                      run: () => callApi(`/api/invitations/${row.invitation!.id}`, "DELETE"),
                                      success: "Invitation annulée",
                                    })}
                                  >
                                    Annuler l&apos;invitation
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={confirming?.title ?? ""}
        description={confirming?.description}
        confirmLabel={confirming?.confirmLabel ?? ""}
        busy={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          if (!confirming) return;
          const { run, success } = confirming;
          setConfirming(null);
          await act(run(), success);
        }}
      />
    </section>
  );
}
