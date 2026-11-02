"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { VIEW_COOKIE } from "@/lib/adminSession";

// Meme deconnexion que le reste de l'app (client + /api/logout), puis retour a la connexion admin.
export default function SignOutButton({ className }: { className?: string }) {
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      await supabase.auth.signOut();
      await fetch("/api/logout", { method: "POST" });
    } catch {}
    document.cookie = `${VIEW_COOKIE}=; path=/; max-age=0`;
    window.location.assign("/admin/connexion");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={leaving}
      className={className}
      style={{
        fontSize: 13, color: "#ccc", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 999, padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap", opacity: leaving ? 0.6 : 1,
      }}
    >
      Se déconnecter
    </button>
  );
}
