const BAR = "rounded bg-white/[0.07]";

// Cale sur ProjetClient : hero en panneau arrondi, colonne principale + sidebar desktop.
export default function ProjectSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] animate-pulse px-5 pt-3 lg:px-12 lg:pt-6">
      {/* Hero */}
      <div className="h-[260px] w-full rounded-panel border border-white/10 bg-white/[0.04] lg:h-[440px]" />

      <div className="pb-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-10 lg:pb-12 lg:pt-8">
        <div className="min-w-0">
          {/* Titre + pastilles + Regarder (mobile) */}
          <div className="lg:hidden">
            <div className={`mb-2 mt-5 h-3 w-36 ${BAR}`} />
            <div className={`mb-3.5 h-8 w-56 ${BAR}`} />
            <div className="mb-5 flex gap-2">
              <div className="h-6 w-24 rounded-pill bg-white/[0.07]" />
              <div className="h-6 w-14 rounded-pill bg-white/[0.07]" />
            </div>
            <div className="mb-6 h-12 w-full rounded-pill bg-white/[0.07]" />
          </div>

          {/* Synopsis */}
          <div className={`mb-3 h-5 w-24 ${BAR}`} />
          <div className="mb-8 space-y-2">
            <div className={`h-3 w-full ${BAR}`} />
            <div className={`h-3 w-4/5 ${BAR}`} />
          </div>

          {/* Equipe */}
          <div className={`mb-3 h-5 w-20 ${BAR}`} />
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass h-[122px] w-[104px] rounded-card" />
            ))}
          </div>
        </div>

        {/* Sidebar desktop : fiche technique, Regarder, createur */}
        <div className="hidden space-y-4 lg:block">
          <div className="glass h-[150px] rounded-card" />
          <div className="h-12 w-full rounded-pill bg-white/[0.07]" />
          <div className="glass h-[86px] rounded-card" />
        </div>
      </div>
    </div>
  );
}
