"use client";

import dynamic from "next/dynamic";

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface Props {
  url: string;
  title: string;
}

export default function VideoEmbed({ url, title }: Props) {
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
