import type { CSSProperties } from "react";

// Avatar partagé (généralisé depuis RecruitmentSpace) — source unique de vérité
// pour l'affichage d'une photo de profil avec fallback initiales.
//
// Règle : on n'affiche les initiales QUE si `url` est falsy (null / "" / undefined).
// Dès qu'une `avatar_url` réelle existe, la photo s'affiche. Le `?t=timestamp`
// éventuel sur l'URL (cache-bust de l'upload) est géré nativement par <img>.
//
// Visuellement flexible via `size`, `shape`, et surcharges `style`/`className`
// (bordure, fond) pour coller au rendu de chaque emplacement sans le changer.

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Avatar({
  url,
  name,
  size = 40,
  shape = "circle",
  className = "",
  style,
  alt = "",
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
  shape?: "circle" | "rounded";
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  const radius = shape === "circle" ? "50%" : Math.round(size * 0.22);
  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // Défauts charte (surchargés par `style` si fourni).
    background: "linear-gradient(135deg, #1a1a1a, #222)",
    border: "1.5px solid rgba(200,255,0,0.3)",
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: Math.max(10, Math.round(size * 0.4)), fontWeight: 600, color: "#C8FF00", lineHeight: 1 }}>
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
