"use client";

import { useState, useEffect } from "react";
import ReactPlayer from "react-player";

interface Props {
  url: string;
}

export default function HeroPlayer({ url }: Props) {
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="w-full h-full">
      <ReactPlayer
        src={url}
        width="100%"
        height="100%"
        playing={playing}
        muted
        loop
        light={!playing}
        onClickPreview={() => setPlaying(true)}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
    </div>
  );
}
