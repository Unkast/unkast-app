export default function SearchSkeleton() {
  return (
    <div className="animate-pulse pb-16 px-5 sm:px-8 pt-6">
      {/* Search bar */}
      <div className="h-11 w-full bg-[#1a1a1a] rounded-xl mb-6" />
      {/* Category grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-[#1a1a1a] rounded-xl" />
        ))}
      </div>
      {/* Profile cards */}
      <div className="h-4 w-32 bg-[#1a1a1a] rounded mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-[#1a1a1a] rounded-xl p-3 space-y-2">
            <div className="w-10 h-10 bg-[#141414] rounded-full" />
            <div className="h-3.5 w-24 bg-[#141414] rounded" />
            <div className="h-3 w-16 bg-[#141414] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
