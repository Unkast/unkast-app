// Meme silhouette que l'attente interne de la conversation (page.tsx), en verre sans flou.
export default function ConversationLoading() {
  return (
    <div role="status" style={{ padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px 20px" }}>
      <span className="sr-only">Chargement...</span>
      <div aria-hidden="true" className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-white/10 animate-pulse" />
        <div className="h-3.5 w-32 rounded bg-white/10 animate-pulse" />
      </div>
      <div aria-hidden="true" className="mt-8 flex flex-col gap-2">
        <div className="glass lite h-11 w-[60%] rounded-card animate-pulse" />
        <div className="glass lite h-16 w-[70%] self-end rounded-card animate-pulse" />
        <div className="glass lite h-11 w-[45%] rounded-card animate-pulse" />
      </div>
    </div>
  );
}
