export default function FeedSkeleton() {
  return (
    <div className="pb-16 lg:pb-0 animate-pulse">
      {/* Hero skeleton */}
      <div className="w-full h-[340px] bg-[#1a1a1a] rounded-b-2xl" />

      {/* Section rows */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-5 sm:px-8 mt-8">
          <div className="flex justify-between mb-3">
            <div className="h-4 w-32 bg-[#1a1a1a] rounded" />
            <div className="h-3 w-16 bg-[#1a1a1a] rounded" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex-shrink-0 w-60 sm:w-72">
                <div className="w-full bg-[#1a1a1a] rounded-xl" style={{ aspectRatio: "16/9" }} />
                <div className="mt-2.5 space-y-1.5">
                  <div className="h-3.5 w-40 bg-[#1a1a1a] rounded" />
                  <div className="h-3 w-24 bg-[#1a1a1a] rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
