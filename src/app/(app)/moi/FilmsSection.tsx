"use client";
// Onglet Films de /moi : jauge, invitations a co-gerer, liste des films geres,
// publication. Ouvert a tous les types de compte.
import { useState } from "react";
import { EnterItem } from "@/components/motion";
import Button from "@/components/ui/Button";
import FilmCard from "./FilmCard";
import PublishForm from "./PublishForm";
import { callApi, type FilmsData, type ShowToast } from "./api";

export default function FilmsSection({
  films,
  userId,
  plan,
  reload,
  showToast,
  onUpsell,
}: {
  films: FilmsData;
  userId: string;
  plan: string;
  reload: () => Promise<void>;
  showToast: ShowToast;
  onUpsell: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const { projects, owned_count: owned, limit, manager_invites: invites } = films;
  const limitReached = owned >= limit;

  async function decideInvite(projectId: string, requestId: string, accept: boolean) {
    setDeciding(true);
    const r = await callApi(`/api/projects/${projectId}/managers`, "PATCH", { request_id: requestId, accept });
    showToast(r.ok ? (accept ? "Tu co-gères maintenant ce film" : "Invitation déclinée") : r.error);
    await reload();
    setDeciding(false);
  }

  return (
    <>
      {/* Jauge : films dont on est Responsable, sur la limite du forfait */}
      <EnterItem className="glass rounded-panel p-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Mes films</h2>
          <p className="text-sm text-text-secondary">
            <span className="text-xl font-semibold text-text-primary">{owned}</span> sur {limit}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Films dont tu es Responsable sur la limite du forfait"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={owned}
          className="mt-3 h-2 overflow-hidden rounded-pill bg-white/10"
        >
          <div
            className={`h-full rounded-pill transition-[width] duration-slow ease-glass ${limitReached ? "bg-orange-400" : "bg-lime shadow-[0_0_12px_rgba(200,255,0,0.5)]"}`}
            style={{ width: `${Math.min(100, (owned / limit) * 100)}%` }}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-secondary">
          Seuls les films dont tu es Responsable comptent. Les films que tu co-gères ne comptent pas.
        </p>
      </EnterItem>

      {/* Invitations a co-gerer recues */}
      {invites.map((inv) => (
        <EnterItem key={inv.request_id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-card border-lime/25 p-3 pl-4">
          <div className="min-w-40 flex-1">
            <p className="text-sm font-semibold text-text-primary">{inv.project_title || "Un film"}</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {inv.invited_by ? `${inv.invited_by} t'invite à co-gérer ce film.` : "Tu es invité à co-gérer ce film."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" disabled={deciding} onClick={() => decideInvite(inv.project_id, inv.request_id, true)}>
              Accepter
            </Button>
            <Button variant="glass" size="sm" disabled={deciding} onClick={() => decideInvite(inv.project_id, inv.request_id, false)}>
              Refuser
            </Button>
          </div>
        </EnterItem>
      ))}

      {/* Films geres */}
      {projects.length === 0 && !adding && (
        <EnterItem className="px-1">
          <p className="text-[13px] text-text-secondary">Tu ne gères aucun film pour le moment.</p>
        </EnterItem>
      )}
      {projects.map((project) => (
        <EnterItem key={project.id} className="glass rounded-card p-3">
          <FilmCard project={project} userId={userId} reload={reload} showToast={showToast} />
        </EnterItem>
      ))}

      {!adding && !limitReached && (
        <EnterItem>
          <Button size="lg" onClick={() => setAdding(true)} fullWidth>
            + Ajouter un film
          </Button>
        </EnterItem>
      )}

      {!adding && limitReached && plan !== "pro" && (
        <EnterItem>
          <Button variant="dashed" onClick={onUpsell} fullWidth>
            Passer à Unkast Pro pour publier plus &rarr;
          </Button>
        </EnterItem>
      )}

      {adding && (
        <EnterItem className="glass rounded-panel border-lime/25 p-5">
          <PublishForm
            showToast={showToast}
            onCancel={() => setAdding(false)}
            onPublished={async () => {
              await reload();
              setAdding(false);
            }}
          />
        </EnterItem>
      )}
    </>
  );
}
