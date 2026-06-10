"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";

export default function ConversionBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem("unkast_banner_dismissed")) {
      return;
    }

    // Don't show if user is logged in
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) return;

      // Listen for scroll after auth check
      function handleScroll() {
        if (window.scrollY > 300 && !sessionStorage.getItem("unkast_banner_dismissed")) {
          setVisible(true);
        }
      }

      window.addEventListener("scroll", handleScroll, { passive: true });
      // Cleanup
      return () => window.removeEventListener("scroll", handleScroll);
    });
  }, []);

  function handleDismiss() {
    sessionStorage.setItem("unkast_banner_dismissed", "1");
    setDismissed(true);
    setVisible(false);
  }

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: "fixed",
            bottom: 64,
            left: 16,
            right: 16,
            background: "rgba(13,13,13,0.95)",
            border: "1px solid rgba(200,255,0,0.2)",
            borderRadius: 14,
            padding: "14px 16px",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            aria-label="Fermer"
            style={{
              position: "absolute",
              top: -8,
              right: -8,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 11,
              color: "#888",
              lineHeight: 1,
            }}
          >
            ×
          </button>

          {/* Left: text */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", margin: 0, lineHeight: 1.3 }}>
              Tu aimes ce que tu vois?
            </p>
            <p style={{ fontSize: 12, color: "#555", margin: 0, marginTop: 2, lineHeight: 1.3 }}>
              Rejoins Unkast, c&apos;est gratuit
            </p>
          </div>

          {/* Right: CTA button */}
          <button
            onClick={() => router.push("/rejoindre")}
            style={{
              background: "#C8FF00",
              color: "#0d0d0d",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 20,
              padding: "8px 16px",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            S&apos;inscrire →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
