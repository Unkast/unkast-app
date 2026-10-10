"use client";

import { VIEW_COOKIE, VIEW_VISITOR } from "@/lib/adminSession";

// « Voir le site comme » : ouvre le site en vue visiteur (le serveur ignore la session,
// voir lib/supabase/server.ts) ou en vue membre (le compte admin connecte, sans profil
// et sans aucune ecriture possible). Cookie de session : il disparait a la fermeture.
export default function ViewAs() {
  function open(visitor: boolean) {
    document.cookie = visitor ? `${VIEW_COOKIE}=${VIEW_VISITOR}; path=/; samesite=lax` : `${VIEW_COOKIE}=; path=/; max-age=0`;
    window.location.assign("/feed");
  }

  const button: React.CSSProperties = {
    fontSize: 13, color: "#ccc", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 999, padding: "5px 12px", cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <span style={{ fontSize: 13, color: "#A8A8B0" }}>Voir le site comme :</span>
      <button type="button" style={button} onClick={() => open(true)}>visiteur</button>
      <button type="button" style={button} onClick={() => open(false)}>membre</button>
    </div>
  );
}
