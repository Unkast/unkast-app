"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";

export default function WelcomeClient() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  // Transparent status bar on welcome page
  useEffect(() => {
    async function setTransparent() {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {}
    }
    setTransparent();
    return () => {
      async function reset() {
        try {
          const { StatusBar } = await import("@capacitor/status-bar");
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setBackgroundColor({ color: "#0d0d0d" });
        } catch {}
      }
      reset();
    };
  }, []);

  useEffect(() => {
    // Connected user → always /feed (Supabase session in localStorage persists)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/feed");
        return;
      }

      // Explorer in same session → /feed (sessionStorage cleared on app close)
      const hasExplored = sessionStorage.getItem("unkast_has_explored");
      if (hasExplored) {
        router.replace("/feed");
        return;
      }

      // Otherwise → show welcome
      setVisible(true);
    });
  }, [router]);

  function handleExplorer() {
    sessionStorage.setItem("unkast_has_explored", "true");
    router.replace("/feed");
  }

  if (!visible) return null;

  return (
    <main className="relative overflow-hidden" style={{ height: "100dvh" }}>
      <Image
        src="/welcome-bg.png"
        alt=""
        fill
        priority
        className="object-cover object-center"
      />

      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, rgba(13,13,13,0.3) 0%, rgba(13,13,13,0.5) 40%, rgba(13,13,13,0.85) 70%, rgba(13,13,13,0.98) 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-end px-7 pb-12 sm:pb-16">
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="mb-3">
          <rect x="1" y="1" width="50" height="50" rx="8" stroke="#C8FF00" strokeWidth="2" />
          <polygon points="21,16 21,36 37,26" fill="#C8FF00" />
        </svg>

        <h1
          className="font-sans text-[#f0f0f0] mb-1.5"
          style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-1px" }}
        >
          Unkast
        </h1>

        <p
          className="font-mono uppercase mb-12"
          style={{ fontSize: 10, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
        >
          Découvre l&apos;œuvre. Trouve le talent.
        </p>

        <button
          onClick={handleExplorer}
          className="w-full font-sans cursor-pointer"
          style={{
            maxWidth: 320,
            padding: 14,
            borderRadius: 14,
            background: "#C8FF00",
            color: "#0d0d0d",
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: "-0.2px",
            border: "none",
            marginBottom: 10,
          }}
        >
          Explorer
        </button>

        <button
          onClick={() => router.push("/connexion")}
          className="w-full font-sans cursor-pointer"
          style={{
            maxWidth: 320,
            padding: 15,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#f0f0f0",
            fontSize: 16,
            fontWeight: 400,
            marginBottom: 24,
          }}
        >
          Se connecter
        </button>

        <p
          className="font-sans text-center"
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.2)",
            maxWidth: 280,
            lineHeight: 1.6,
          }}
        >
          En continuant, tu acceptes nos conditions d&apos;utilisation et notre politique de confidentialité
        </p>
      </div>
    </main>
  );
}
