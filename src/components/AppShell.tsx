"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Explorer",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/recherche",
    label: "Recherche",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Mon profil",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/projets",
    label: "Mes projets",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 4V2m0 2a2 2 0 100 4m0-4a2 2 0 110 4m0 0v14m7-10V2m0 2a2 2 0 100 4m0-4a2 2 0 110 4m0 0v6m7-8V2m0 2a2 2 0 100 4m0-4a2 2 0 110 4m0 0v10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/contacts",
    label: "Contacts",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-border bg-[#0a0a0a]">
        {/* Logo */}
        <div className="h-12 flex items-center px-4 border-b border-border">
          <Link href="/" className="text-lg font-extrabold text-text-primary">
            Unkast<span className="text-lime">.</span>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition ${
                  active
                    ? "bg-white/8 text-text-primary"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                }`}
              >
                <span className={active ? "text-lime" : "text-text-tertiary"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom CTA */}
        <div className="p-3 border-t border-border">
          <Link
            href="/rejoindre"
            className="block w-full py-2 text-center bg-lime text-[#0d0d0d] font-bold text-xs rounded-lg hover:brightness-110 transition"
          >
            Creer mon profil
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-[#0a0a0a] flex-shrink-0">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden text-lg font-extrabold text-text-primary">
            Unkast<span className="text-lime">.</span>
          </Link>
          {/* Desktop: breadcrumb-style current section */}
          <span className="hidden lg:block text-sm text-text-tertiary">
            {NAV_ITEMS.find((i) => isActive(i.href))?.label ?? ""}
          </span>

          <div className="flex items-center gap-2">
            <Link
              href="/recherche"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-tertiary hover:text-text-primary transition"
              aria-label="Recherche"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
            <Link
              href="/rejoindre"
              className="hidden sm:block px-3 py-1.5 bg-lime text-[#0d0d0d] font-bold text-xs rounded-lg hover:brightness-110 transition lg:hidden"
            >
              Creer mon profil
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0a0a0a] border-t border-border">
        <div className="flex items-center justify-around h-14 px-1">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition ${
                  active ? "text-lime" : "text-text-tertiary"
                }`}
              >
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
