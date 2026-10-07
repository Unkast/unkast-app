const BAR = "rounded bg-white/[0.07]";

// Cale sur ProfileClient : panneau verre a gauche (avatar 112 px), cartes projet a droite.
export default function ProfileSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] animate-pulse flex-col px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:gap-12 lg:px-12 lg:py-10 xl:px-16">
      {/* Panneau profil */}
      <div className="glass mb-8 rounded-panel p-5 sm:p-6 lg:mb-0 lg:w-80 lg:shrink-0">
        <div className="mb-5 size-28 rounded-full bg-white/[0.07]" />
        <div className={`mb-4 h-8 w-48 ${BAR}`} />
        <div className="mb-4 flex gap-2">
          <div className="h-9 w-28 rounded-pill bg-white/[0.07]" />
          <div className="h-9 w-24 rounded-pill bg-white/[0.07]" />
        </div>
        <div className="mb-6 space-y-2">
          <div className={`h-3 w-full ${BAR}`} />
          <div className={`h-3 w-4/5 ${BAR}`} />
          <div className={`h-3 w-2/3 ${BAR}`} />
        </div>
        <div className="h-11 w-full max-w-[240px] rounded-pill bg-white/[0.07]" />
      </div>

      {/* Projets */}
      <div className="min-w-0 flex-1">
        <div className={`mb-4 h-7 w-28 ${BAR}`} />
        <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="glass overflow-hidden rounded-media">
              <div className="aspect-video w-full bg-white/[0.04]" />
              <div className="space-y-3 p-5 sm:p-6">
                <div className={`h-5 w-40 ${BAR}`} />
                <div className={`h-3 w-full ${BAR}`} />
                <div className={`h-3 w-3/4 ${BAR}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
