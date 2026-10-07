const BAR = "rounded bg-white/[0.07]";

// Cale sur feed/page.tsx : hero (eventail mobile, billboard desktop) puis rangees de cartes.
export default function FeedSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] animate-pulse">
      {/* Hero mobile : eventail + infos du film */}
      <div className="lg:hidden">
        <div className="flex h-[320px] items-center justify-center">
          <div className="glass h-[260px] w-[180px] rounded-media" />
        </div>
        <div className="mt-6 space-y-3 px-5 pt-3.5">
          <div className={`h-3 w-12 ${BAR}`} />
          <div className={`h-7 w-56 ${BAR}`} />
          <div className="h-7 w-32 rounded-pill bg-white/[0.07]" />
          <div className="h-11 w-full rounded-pill bg-white/[0.07]" />
        </div>
      </div>

      {/* Hero desktop : billboard */}
      <div className="hidden px-12 pt-2 lg:block xl:px-16">
        <div className="glass h-[460px] rounded-panel xl:h-[540px]" />
      </div>

      {/* Rangees */}
      <div className="space-y-8 py-6 lg:space-y-12 lg:py-10">
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
