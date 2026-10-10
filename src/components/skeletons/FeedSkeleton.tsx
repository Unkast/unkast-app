const BAR = "rounded bg-white/[0.07]";

// Cale sur feed/page.tsx : bloc a la une (texte + affiche 16:9, une colonne en mobile,
// puis les vignettes) et rangees de cartes.
export default function FeedSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] animate-pulse">
      {/* Bloc a la une */}
      <div className="px-2 pt-2 md:px-4 md:pt-4 lg:px-10 lg:pt-7">
        <div className="glass overflow-hidden rounded-panel-lg md:p-[22px] xl:px-11 xl:pb-[26px] xl:pt-11">
          <div className="grid items-center gap-3 md:gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-12">
            {/* Mobile : titre et ligne d'infos seuls */}
            <div className="space-y-1.5 max-md:px-4 md:space-y-[18px]">
              <div className={`h-3 w-32 max-md:hidden ${BAR}`} />
              <div className={`h-7 w-4/5 md:h-10 lg:h-14 ${BAR}`} />
              <div className={`h-3.5 w-52 ${BAR}`} />
              <div className={`h-4 w-full max-w-[440px] max-md:hidden ${BAR}`} />
              <div className="flex gap-2.5 pt-1.5 max-md:hidden">
                <div className="h-11 w-36 rounded-pill bg-white/[0.07]" />
                <div className="h-11 w-32 rounded-pill bg-white/[0.07]" />
              </div>
            </div>
            <div className="aspect-video w-full bg-white/[0.07] max-xl:order-first md:rounded-[20px]" />
          </div>
          <div className="flex gap-1.5 px-4 pb-2 pt-1 md:mt-6 md:grid md:grid-cols-3 md:gap-3.5 md:border-t md:border-white/[0.08] md:px-0 md:pb-0 md:pt-[22px] lg:grid-cols-5 xl:mt-[34px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 space-y-2 max-md:py-2">
                <div className="h-[3px] w-full rounded-sm bg-white/[0.14] md:hidden" />
                <div className="aspect-video w-full rounded-[10px] bg-white/[0.07] max-md:hidden" />
                <div className={`h-3 w-24 max-md:hidden ${BAR}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rangees */}
      <div className="space-y-8 pb-6 pt-4 md:pt-6 lg:space-y-12 lg:py-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mb-3 flex justify-between lg:mb-4">
              <div className={`h-5 w-32 ${BAR}`} />
              <div className={`h-3 w-16 ${BAR}`} />
            </div>
            <div className="flex gap-3 overflow-hidden lg:gap-4">
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="w-60 shrink-0 sm:w-72 lg:w-80">
                  <div className="glass aspect-video w-full rounded-media" />
                  <div className="mt-2.5 space-y-1.5 px-0.5">
                    <div className={`h-3.5 w-40 ${BAR}`} />
                    <div className={`h-3 w-24 ${BAR}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
