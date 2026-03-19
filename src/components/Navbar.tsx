"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[#1a1a1a] bg-[#0d0d0d]/80 backdrop-blur-[20px]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-extrabold text-text-primary">
          Unkast<span className="text-lime">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/recherche"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Explorer
          </Link>
          <Link
            href="/rejoindre"
            className="px-4 py-2 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition"
          >
            Creer mon profil
          </Link>
        </div>
      </div>
    </nav>
  );
}
