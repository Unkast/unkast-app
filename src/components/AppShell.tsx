"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Explorer",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/recherche",
    label: "Recherche",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Mon profil",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/projets",
    label: "Mes projets",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 4V2m0 2a2 2 0 100 4m0-4a2 2 0 110 4m0 0v14m7-10V2m0 2a2 2 0 100 4m0-4a2 2 0 110 4m0 0v6m7-8V2m0 2a2 2 0 100 4m0-4a2 2 0 110 4m0 0v10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/contacts",
    label: "Contacts",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

function useActiveIndex(pathname: string) {
  return NAV_ITEMS.findIndex((item) => {
    if (item.href === "/") return pathname === "/";
    return pathname.startsWith(item.href);
  });
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeIndex = useActiveIndex(pathname);
  const navRef = useRef<HTMLElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 });

  // Animate sidebar indicator
  useEffect(() => {
    if (!navRef.current || activeIndex < 0) return;
    const links = navRef.current.querySelectorAll("a");
    const el = links[activeIndex];
    if (el) {
      setIndicatorStyle({ top: el.offsetTop, height: el.offsetHeight });
    }
  }, [activeIndex]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-white/5 bg-[#0a0a0a]">
        <div className="h-12 flex items-center px-5 border-b border-white/5">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-text-primary">
            Unkast<span className="text-lime">.</span>
          </Link>
        </div>

        <nav ref={navRef} className="relative flex-1 py-3 px-2.5 space-y-0.5">
          {/* Sliding highlight */}
          <AnimatePresence>
            {activeIndex >= 0 && (
              <motion.div
                layoutId="sidebar-indicator"
                className="absolute left-2.5 right-2.5 rounded-lg bg-white/[0.06]"
                style={{ top: indicatorStyle.top, height: indicatorStyle.height }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
          </AnimatePresence>

          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200 ${
                  active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <span className={`transition-colors duration-200 ${active ? "text-lime" : "text-text-tertiary"}`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/rejoindre"
              className="block w-full py-2.5 text-center bg-lime text-[#0d0d0d] font-bold text-xs rounded-lg transition"
            >
              Creer mon profil
            </Link>
          </motion.div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl flex-shrink-0">
          <Link href="/" className="lg:hidden text-lg font-extrabold tracking-tight text-text-primary">
            Unkast<span className="text-lime">.</span>
          </Link>
          <span className="hidden lg:block text-[13px] text-text-tertiary font-medium">
            {NAV_ITEMS.find((_, i) => i === activeIndex)?.label ?? ""}
          </span>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/recherche"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-tertiary hover:text-text-primary transition-colors"
                aria-label="Recherche"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Link>
            </motion.div>
            <Link
              href="/rejoindre"
              className="hidden sm:block lg:hidden px-3 py-1.5 bg-lime text-[#0d0d0d] font-bold text-xs rounded-lg"
            >
              Creer mon profil
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/5 safe-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  active ? "text-lime" : "text-text-tertiary"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -top-1 w-5 h-0.5 rounded-full bg-lime"
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
