"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const SPLASH_KEY = "unkast_splash_time";
const SPLASH_DELAY = 30 * 60 * 1000; // 30 minutes

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const dismissed = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const checked = useRef(false);

  const handleEnd = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    try { localStorage.setItem(SPLASH_KEY, Date.now().toString()); } catch {}
    setFading(true);
    setTimeout(() => setShow(false), 600);
  }, []);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // Check if splash should play
    let shouldPlay = true;
    try {
      const last = localStorage.getItem(SPLASH_KEY);
      if (last && Date.now() - parseInt(last) < SPLASH_DELAY) {
        shouldPlay = false;
      }
    } catch {}

    if (!shouldPlay) return; // No splash, children already visible

    setShow(true);

    const fallback = setTimeout(handleEnd, 6000);

    // Small delay to let the video element mount
    requestAnimationFrame(() => {
      const video = videoRef.current;
      if (video) {
        video.muted = true;
        const onPlaying = () => setPlaying(true);
        video.addEventListener("playing", onPlaying);
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => handleEnd());
        }
      }
    });

    return () => clearTimeout(fallback);
  }, [handleEnd]);

  return (
    <>
      {children}

      {show && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0d0d0d",
            opacity: fading ? 0 : 1,
            transition: "opacity 600ms ease",
            pointerEvents: fading ? "none" : "auto",
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src="/splash.mp4"
            muted
            playsInline
            disablePictureInPicture
            preload="auto"
            onEnded={handleEnd}
            controlsList="nodownload nofullscreen noremoteplayback"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          {!playing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#0d0d0d",
                zIndex: 1,
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
