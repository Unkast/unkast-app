const BAR = "rounded bg-white/[0.07]";

// Cale sur categories/[slug]/page.tsx : titre + compteur, film a la une, grille de cartes.
export default function CategoryLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] animate-pulse pb-8 lg:px-12 lg:pb-12 xl:px-16">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className={`h-[35px] w-44 lg:h-[46px] lg:w-60 ${BAR}`} />
        <div className="h-6 w-16 rounded-pill bg-white/[0.07]" />
      </div>

      {/* Film a la une */}
      <div className="px-4 lg:px-1">
        <div className="glass mb-4 aspect-video rounded-panel lg:mb-6 lg:aspect-[21/9]" />
      </div>

      {/* Grille */}
      <div className="grid grid-cols-2 gap-2.5 px-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4 lg:px-1">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="glass rounded-card p-2.5">
            <div className="aspect-video w-full rounded-media bg-white/[0.07]" />
            <div className="mt-2.5 px-1 pb-0.5">
              <div className={`h-[15px] w-3/4 ${BAR}`} />
              <div className={`mt-1 h-[18px] w-1/2 ${BAR}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
