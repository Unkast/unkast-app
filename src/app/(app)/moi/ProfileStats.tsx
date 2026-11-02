"use client";

// Carte « Statistiques » de l'onglet Profil de /moi (plan Pro, etape 2).
// Pro : chiffres de GET /api/me/stats. Gratuit : la route renvoie { locked: true }
// sans aucun chiffre ; l'apercu floute montre des FAUX chiffres fixes (FAKE_STATS).

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { SectionLabel } from "./parts";

type Stats = {
  views_7d: number;
  views_30d: number;
  views_total: number;
  list_adds_total: number;
  message_clicks_total: number;
};

type State = { status: "loading" } | { status: "locked" } | { status: "error" } | { status: "ready"; stats: Stats };

// Jamais les vrais chiffres : decor de l'apercu verrouille.
const FAKE_STATS: Stats = { views_7d: 24, views_30d: 87, views_total: 312, list_adds_total: 6, message_clicks_total: 9 };

function tiles(s: Stats) {
  return [
    { label: "Visites, 7 jours", value: s.views_7d },
    { label: "Visites, 30 jours", value: s.views_30d },
    { label: "Ajouté à une liste", value: s.list_adds_total },
    { label: "Clics « Envoyer un message »", value: s.message_clicks_total },
  ];
}

function StatGrid({ stats }: { stats: Stats }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles(stats).map((t) => (
          <div key={t.label} className="rounded-card border border-white/10 bg-white/5 p-3">
            <dd className="font-mono text-2xl font-semibold tabular-nums text-text-primary">{t.value}</dd>
            <dt className="mt-1 text-xs leading-snug text-text-secondary">{t.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-text-secondary">
        {stats.views_total} {stats.views_total > 1 ? "visites" : "visite"} depuis le début
      </p>
    </>
  );
}

export default function ProfileStats() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/stats")
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setState({ status: "error" });
        else if (data.locked) setState({ status: "locked" });
        else setState({ status: "ready", stats: data as Stats });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return null;

  return (
    <section aria-labelledby="profile-stats-title" className="glass rounded-panel p-5 sm:p-6">
      <SectionLabel>
        <span id="profile-stats-title">Statistiques du profil</span>
      </SectionLabel>

      {state.status === "error" && <p className="mt-3 text-xs text-text-secondary">Statistiques indisponibles pour le moment.</p>}

      {state.status === "ready" && (
        <div className="mt-4">
          <StatGrid stats={state.stats} />
          <p className="mt-1 text-xs text-text-secondary">Des chiffres seulement : l&apos;identité des visiteurs n&apos;est jamais enregistrée.</p>
        </div>
      )}

      {state.status === "locked" && (
        <div className="relative mt-4">
          <div aria-hidden="true" inert className="pointer-events-none select-none blur-[6px]">
            <StatGrid stats={FAKE_STATS} />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <p className="max-w-xs text-sm font-medium text-text-primary">Passe Pro pour voir qui te regarde en chiffres</p>
            <Button variant="accent" size="sm" href="/pro">
              Découvrir le Pro
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
