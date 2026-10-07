import type { HTMLAttributes } from "react";

export default function GlassCard({
  strong = false,
  radius = "card",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean; radius?: "card" | "panel" }) {
  return (
    <div
      className={`${strong ? "glass-strong" : "glass"} ${radius === "panel" ? "rounded-panel" : "rounded-card"} ${className}`}
      {...props}
    />
  );
}
