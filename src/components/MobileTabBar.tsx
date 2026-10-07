import Link from "next/link";
import type { DockItem } from "@/components/LiquidDock";

// Barre d'onglets mobile du NAVIGATEUR (rendu par defaut d'AppShell) : plate, en verre
// fort, collee en bas, 56 px + safe area. L'app installee (Capacitor / PWA) utilise
// LiquidDock a la place — voir la detection `app-installed` dans AppShell.
// Hauteur = celle que les pages reservent deja avec .pb-tabbar (56 px + safe area).

export default function MobileTabBar({
  items,
  activeIndex,
  hidden = false,
}: {
  items: DockItem[];
  activeIndex: number;
  /** Sort la barre par le bas (conversation ouverte, clavier virtuel). */
  hidden?: boolean;
}) {
  return (
    <nav
      aria-label="Navigation principale"
      inert={hidden}
      className={`lg:hidden [.app-installed_&]:hidden fixed inset-x-0 bottom-0 z-50 glass-strong rounded-none border-x-0 border-b-0 transition-[translate,opacity] duration-base ease-glass ${
        hidden ? "pointer-events-none translate-y-full opacity-0 motion-reduce:translate-y-0" : ""
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-14">
        {items.map((item, i) => {
          const active = i === activeIndex;
          const unread = (item.badge ?? 0) > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={unread ? `${item.label}, messages non lus` : undefined}
              aria-current={active ? "page" : undefined}
              className={`flex h-full min-w-11 flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime ${
                active ? "text-lime" : "text-text-secondary"
              }`}
            >
              <span className="relative flex items-center justify-center [&>svg]:size-[22px]">
                {item.icon}
                {unread && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#ef4444]" />}
              </span>
              <span className="text-[10.5px] font-medium leading-none tracking-[0.02em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
