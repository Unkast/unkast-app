"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface Props {
  url: string;
}

export default function HeroPlayer({ url }: Props) {
  const [playing, setPlaying] = useState(false);

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
