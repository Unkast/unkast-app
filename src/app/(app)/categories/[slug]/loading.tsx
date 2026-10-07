export default function CategoryLoading() {
  return (
    <div>
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.15} }`}</style>
      <div className="px-5 pt-5 pb-4">
        <div style={{ width: 140, height: 22, background: "#1a1a1a", borderRadius: 6, animation: "skeleton-pulse 1.5s ease infinite" }} />
      </div>
      <div className="px-4">
        <div style={{ aspectRatio: "16/9", background: "#1a1a1a", borderRadius: 12, animation: "skeleton-pulse 1.5s ease infinite", marginBottom: 16 }} />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div style={{ aspectRatio: "16/9", background: "#1a1a1a", borderRadius: 8, animation: "skeleton-pulse 1.5s ease infinite", marginBottom: 8 }} />
              <div style={{ width: "75%", height: 13, background: "#1a1a1a", borderRadius: 4, animation: "skeleton-pulse 1.5s ease infinite" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
