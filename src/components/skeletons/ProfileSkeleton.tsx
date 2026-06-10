export default function ProfileSkeleton() {
  return (
    <div className="animate-pulse pb-16 px-5 sm:px-8 pt-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-[88px] h-[88px] bg-[#1a1a1a] rounded-full" />
        <div className="space-y-2">
          <div className="h-5 w-40 bg-[#1a1a1a] rounded" />
          <div className="h-3 w-24 bg-[#1a1a1a] rounded" />
        </div>
      </div>
      {/* Role pills */}
      <div className="flex gap-2 mb-4">
        <div className="h-7 w-20 bg-[#1a1a1a] rounded-full" />
        <div className="h-7 w-24 bg-[#1a1a1a] rounded-full" />
      </div>
      {/* Bio */}
      <div className="space-y-2 mb-6">
        <div className="h-3 w-full bg-[#1a1a1a] rounded" />
        <div className="h-3 w-4/5 bg-[#1a1a1a] rounded" />
        <div className="h-3 w-2/3 bg-[#1a1a1a] rounded" />
      </div>
      {/* Projects */}
      <div className="h-4 w-28 bg-[#1a1a1a] rounded mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-[#1a1a1a] rounded-xl" style={{ aspectRatio: "16/9" }} />
        ))}
      </div>
    </div>
  );
}
