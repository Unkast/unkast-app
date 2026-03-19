"use client";

import { useState, useEffect } from "react";
import ReactPlayer from "react-player";

interface Props {
  url: string;
  title: string;
}

export default function VideoEmbed({ url, title }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="relative w-full bg-card" style={{ aspectRatio: "16 / 9" }} />;
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
      <ReactPlayer
        src={url}
        width="100%"
        height="100%"
        controls
        light
        playing={false}
        style={{ position: "absolute", top: 0, left: 0 }}
        previewAriaLabel={`Video: ${title}`}
      />
    </div>
  );
}
