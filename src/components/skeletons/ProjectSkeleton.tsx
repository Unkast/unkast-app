export default function ProjectSkeleton() {
  return (
    <div className="animate-pulse pb-16">
      {/* Video hero */}
      <div className="w-full h-[260px] bg-[#1a1a1a]" />

      <div className="px-5 sm:px-8 py-6 space-y-4">
        {/* Category badge */}
        <div className="h-5 w-20 bg-[#1a1a1a] rounded-full" />
        {/* Title */}
        <div className="h-6 w-64 bg-[#1a1a1a] rounded" />
        {/* Subtitle */}
        <div className="h-4 w-40 bg-[#1a1a1a] rounded" />
        {/* Description */}
        <div className="space-y-2 pt-2">
          <div className="h-3 w-full bg-[#1a1a1a] rounded" />
          <div className="h-3 w-4/5 bg-[#1a1a1a] rounded" />
          <div className="h-3 w-3/5 bg-[#1a1a1a] rounded" />
        </div>
        {/* Action button */}
        <div className="h-12 w-full bg-[#1a1a1a] rounded-xl mt-4" />
        {/* Team section */}
        <div className="pt-6 space-y-3">
          <div className="h-4 w-24 bg-[#1a1a1a] rounded" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1a1a1a] rounded-full" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 bg-[#1a1a1a] rounded" />
                <div className="h-3 w-20 bg-[#1a1a1a] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
