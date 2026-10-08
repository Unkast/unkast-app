const BAR = "rounded bg-white/[0.07]";

// Cale sur pro/page.tsx : en-tete centre, deux panneaux (Pro en premier en mobile), bloc d'action.
export default function ProLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[880px] animate-pulse flex-col gap-5 px-4 pt-6 pb-10 lg:gap-6 lg:pt-12 lg:pb-16">
      <div className="flex flex-col items-center">
        <div className="mb-4 h-6 w-24 rounded-pill bg-white/[0.07]" />
        <div className={`mb-3 h-[46px] w-56 lg:h-16 lg:w-80 ${BAR}`} />
        <div className={`h-4 w-full max-w-[320px] ${BAR}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:gap-5">
        {[0, 1].map((i) => (
          <div key={i} className={`${i === 1 ? "glass-strong max-md:order-first" : "glass"} rounded-panel p-5 lg:p-7`}>
            <div className="h-6 w-16 rounded-pill bg-white/[0.07]" />
            <div className={`mt-4 mb-5 h-14 w-40 lg:h-[72px] ${BAR}`} />
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                <div key={j} className={`h-5 ${j % 2 ? "w-2/3" : "w-4/5"} ${BAR}`} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="glass mx-auto w-full max-w-xl rounded-panel p-5 lg:p-7">
        <div className={`mb-3 h-5 w-40 ${BAR}`} />
        <div className={`mb-5 h-4 w-64 max-w-full ${BAR}`} />
        <div className="flex flex-col gap-3">
          <div className="h-12 rounded-pill bg-white/[0.07]" />
          <div className="h-12 rounded-pill bg-white/[0.07]" />
        </div>
      </div>
    </div>
  );
}
