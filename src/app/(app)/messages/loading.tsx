import GlassCard from "@/components/ui/GlassCard";

// Cale sur la liste de messages (page.tsx : PAGE, titre, recherche, cinq lignes).
export default function MessagesLoading() {
  return (
    <div role="status" className="mx-auto max-w-[600px] px-4 pt-5 pb-8">
      <span className="sr-only">Chargement...</span>
      <div aria-hidden="true" className="mb-4 h-9 w-40 rounded-card bg-white/10 animate-pulse" />
      <div aria-hidden="true" className="glass mb-5 h-11 rounded-card" />
      <div aria-hidden="true" className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <GlassCard key={i} className="flex items-center gap-3 p-3">
            <div className="size-12 shrink-0 rounded-full bg-white/10 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-32 rounded bg-white/10 animate-pulse" />
              <div className="mt-2 h-3 w-48 max-w-full rounded bg-white/5 animate-pulse" />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
