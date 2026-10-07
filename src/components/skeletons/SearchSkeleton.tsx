const BAR = "rounded bg-white/[0.07]";

// Cale sur RechercheClient (mode Parcourir) : titre, bascule, tuiles de categorie, metiers.
export default function SearchSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] animate-pulse lg:px-12 xl:px-16">
      <div className="px-5 pt-5">
        <div className={`h-9 w-36 lg:h-12 lg:w-48 ${BAR}`} />
      </div>

      {/* Parcourir / Rechercher */}
      <div className="flex gap-2 px-5 py-4">
        <div className="h-9 w-24 rounded-pill bg-white/[0.07]" />
        <div className="h-9 w-28 rounded-pill bg-white/[0.07]" />
      </div>

      {/* Tuiles de categorie */}
      <div className="grid grid-cols-2 gap-2.5 px-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4 lg:px-1">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="glass h-[140px] rounded-panel" />
        ))}
      </div>

      {/* Metiers */}
      <div className="px-5 pt-8">
        <div className={`mb-3 h-5 w-20 ${BAR}`} />
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-28 shrink-0 rounded-pill bg-white/[0.07]" />
          ))}
        </div>
      </div>
    </div>
  );
}
