"use client";

import { useState, useEffect } from "react";

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    // Already seen this session — skip entirely
    if (sessionStorage.getItem("unkast_splash_seen")) {
      setHide(true);
      return;
    }

    // Mark as seen
    sessionStorage.setItem("unkast_splash_seen", "1");

    // Remove splash after animation completes (CSS handles the timing)
    const timer = setTimeout(() => setHide(true), 5500);
    return () => clearTimeout(timer);
  }, []);

  if (hide) return <>{children}</>;

  return (
    <>
      {children}

      {/*
        Pure CSS splash:
        - Shows for 4s
        - Fades out over 1s
        - Then gets removed by React after 5.5s
        - Works even if JS is slow to hydrate
      */}
      <div className="splash-overlay">
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          className="splash-video"
        >
          <source src="/splash.mp4" type="video/mp4" />
        </video>
        <button
          onClick={() => setHide(true)}
          className="splash-skip"
        >
          Passer
        </button>
      </div>
    </>
  );
}
