import Link from "next/link";
import type { ReactNode } from "react";

// Dock mobile "verre liquide" d'AppShell.
//
// Geometrie (px) : barre 56, bille 44 qui depasse de 14 au-dessus de la barre
// (centre a y = 8 depuis le haut de la barre), collerette 60 concentrique.
// La barre et la collerette sont deux formes pleines de la meme couleur, fusionnees
// par le filtre SVG goo. Le fond doit rester OPAQUE : le filtre seuille l'alpha,
// un fond translucide disparaitrait. Le lisere d'1 px est produit par le filtre
// (dilatation du contour fusionne), une bordure CSS serait mangee par le flou.
//
// Deplacement : chaque forme vit dans un "slot" large d'un onglet, translate de
// index * 100 % — aucune mesure du DOM. Les transitions sont en CSS, donc coupees
// par la regle prefers-reduced-motion de globals.css : la bille saute directement.

export interface DockItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

const BAR_COLOR = "#121217";
const EASE_DOCK = "cubic-bezier(0.65, 0, 0.35, 1)";
// L'icone monte avec la bille (600 ms) mais ne change de couleur qu'a son arrivee :
// sombre trop tot, elle serait invisible sur la barre. A l'inverse, l'icone quittee
// repasse en clair des que la bille s'est ecartee.
const ICON_TRANSITION_IN = `translate 600ms ${EASE_DOCK}, color 120ms linear 420ms`;
const ICON_TRANSITION_OUT = `translate 600ms ${EASE_DOCK}, color 120ms linear 180ms`;

export default function LiquidDock({
  items,
  activeIndex,
  hidden = false,
}: {
  items: DockItem[];
  activeIndex: number;
  /** Sort le dock par le bas (conversation ouverte, clavier virtuel). */
  hidden?: boolean;
}) {
  const slot = { width: `${100 / items.length}%`, transform: `translateX(${activeIndex * 100}%)` };
  const hasActive = activeIndex >= 0;

  return (
    <nav
      aria-label="Navigation principale"
      inert={hidden}
      // Cache : sort de 88 px (collerette 22 + barre 56 + marge 10) + safe area, en 250 ms.
      // En reduced motion il reste en place et s'efface seulement (fondu).
      // Affiche uniquement dans l'app installee (classe app-installed posee par AppShell).
      className={`hidden max-lg:[.app-installed_&]:block fixed inset-x-[12px] z-50 h-14 transition-[translate,opacity] duration-base ease-glass ${
        hidden
          ? "pointer-events-none translate-y-[calc(100%+32px+env(safe-area-inset-bottom,0px))] opacity-0 motion-reduce:translate-y-0"
          : ""
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="dock-goo" x="-20%" y="-30%" width="140%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
          <feMorphology in="goo" operator="dilate" radius="1" result="fat" />
          <feFlood floodColor="#fff" floodOpacity="0.14" result="edge-color" />
          <feComposite in="edge-color" in2="fat" operator="in" result="edge" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="goo" />
          </feMerge>
        </filter>
      </svg>

      {/* Barre + collerette, fusionnees. Le calque deborde vers le haut pour contenir la collerette. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-14 bottom-0"
        style={{ filter: "url(#dock-goo)" }}
      >
        <div className="absolute inset-x-0 bottom-0 h-14 rounded-[28px]" style={{ background: BAR_COLOR }} />
        {hasActive && (
          <div
            className="absolute bottom-0 left-0 h-14 transition-transform duration-slower ease-dock delay-[140ms]"
            style={slot}
          >
            <div
              className="absolute left-1/2 top-[8px] size-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: BAR_COLOR }}
            />
          </div>
        )}
      </div>

      {/* Bille */}
      {hasActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-14 transition-transform duration-slower ease-dock"
          style={slot}
        >
          <div
            className="absolute left-1/2 -top-[14px] size-11 -translate-x-1/2 rounded-full"
            style={{ background: "var(--accent-gradient)", boxShadow: "var(--accent-halo)" }}
          />
        </div>
      )}

      <div className="relative flex h-full">
        {items.map((item, i) => {
          const active = i === activeIndex;
          const unread = (item.badge ?? 0) > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={unread ? `${item.label}, messages non lus` : item.label}
              aria-current={active ? "page" : undefined}
              className="relative flex h-full min-w-11 flex-1 items-center justify-center rounded-[22px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime"
            >
              <span
                aria-hidden="true"
                className={`relative flex items-center justify-center [&>svg]:size-[22px] ${
                  active ? "-translate-y-[20px] text-canvas" : "text-text-secondary"
                }`}
                style={{ transition: active ? ICON_TRANSITION_IN : ICON_TRANSITION_OUT }}
              >
                {item.icon}
                {unread && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#ef4444]" />}
              </span>
              <span
                aria-hidden="true"
                className={`absolute bottom-[5px] text-[10.5px] font-semibold leading-none tracking-[0.02em] text-lime transition-opacity duration-base ${
                  active ? "opacity-100 delay-300" : "opacity-0"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
