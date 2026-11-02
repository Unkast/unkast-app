"use client";

// Nav flottante de la page de vente. Desktop (> 960 px) : ancres et boutons dans la barre.
// Mobile : les ancres sont masquees, un bouton menu ouvre un panneau en verre.
// Fermeture : clic sur un lien, toucher hors du panneau (sans fermer sur une fin de
// selection de texte), touche Echap. Le panneau est hors du <nav> : le flou
// d'arriere-plan de .glass ferait du <nav> le repere du voile en position fixe.
import { useEffect, useRef, useState } from "react";
import s from "./site.module.css";
import { APP, cx } from "./ui";

const LINKS = [
  { href: "#concept", label: "Le concept" },
  { href: "#etapes", label: "Comment ça marche" },
  { href: "#pourqui", label: "Pour qui" },
  { href: "#tarifs", label: "Tarifs" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const downOnVeil = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div style={{ position: "sticky", top: "16px", zIndex: "50", display: "flex", justifyContent: "center", padding: "0 16px" }}>
      <nav className={cx(s.glass, s.in, s.navBar)} style={{ width: "100%", maxWidth: "1180px", borderRadius: "999px", padding: "10px 10px 10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", boxSizing: "border-box" }}>
        <a href="#top" className={s.logo} style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "#ffffff" }}>
          <span style={{ width: "26px", height: "26px", borderRadius: "8px", background: "var(--y)", display: "grid", placeItems: "center", boxShadow: "0 0 24px color-mix(in srgb, var(--y) 60%, transparent)" }}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9L10.5 6z" fill="#0A0A0A"></path></svg></span>
          <span style={{ fontWeight: "800", fontSize: "19px", letterSpacing: "0.16em" }}>UNKAST</span>
        </a>
        <div className={s["hide-m"]} style={{ display: "flex", gap: "2px" }}>
          {LINKS.map((l) => <a key={l.href} className={s["nav-a"]} href={l.href}>{l.label}</a>)}
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <a className={cx(s["nav-a"], s["hide-m"])} href={APP.feed}>Explorer</a>
          <a className={cx(s["nav-a"], s["hide-m"])} href={APP.login}>Se connecter</a>
          <a className={cx(s.btn, s["btn-y"])} href={APP.join} style={{ minHeight: "44px", padding: "0 20px", fontSize: "14px" }}>Rejoindre</a>
          <button ref={button} type="button" className={s.burger} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="menu-mobile" onClick={() => setOpen(!open)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18"></path> : <path d="M4 7h16M4 12h16M4 17h16"></path>}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <>
          {/* Voile invisible : un toucher hors du panneau ferme le menu. */}
          <div
            aria-hidden="true"
            style={{ position: "fixed", inset: "0", zIndex: "-1" }}
            onMouseDown={(e) => { downOnVeil.current = e.target === e.currentTarget; }}
            onClick={(e) => {
              if (downOnVeil.current && e.target === e.currentTarget) close();
              downOnVeil.current = false;
            }}
          ></div>
          <div id="menu-mobile" className={cx(s.glass, s.menu)} onMouseDown={(e) => e.stopPropagation()}>
            {[...LINKS, { href: "#faq", label: "FAQ" }].map((l) => (
              <a key={l.href} className={s.menuA} href={l.href} onClick={close}>{l.label}</a>
            ))}
            <a className={s.menuA} href={APP.feed} onClick={close}>Explorer</a>
            <div style={{ height: "1px", background: "rgba(255,255,255,.1)", margin: "8px 4px" }}></div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "8px" }}>
              <a className={cx(s.btn, s["btn-g"], s.glass)} href={APP.login} onClick={close} style={{ minHeight: "48px", padding: "0 12px", fontSize: "15px" }}>Se connecter</a>
              <a className={cx(s.btn, s["btn-y"])} href={APP.join} onClick={close} style={{ minHeight: "48px", padding: "0 12px", fontSize: "15px" }}>Rejoindre</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
