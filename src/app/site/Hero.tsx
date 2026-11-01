"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import s from "./site.module.css";
import { APP, Arrow, Check, ExampleChip, LIME_DEEP, Play, Poster, cx, vars, type SiteFilm } from "./ui";

// Avatars de l'equipe (initiales, comme un visiteur les voit dans l'app).
const AVATAR_BG = [
  { background: "linear-gradient(135deg, var(--v), #4C1D95)" },
  { background: `linear-gradient(135deg, var(--y), ${LIME_DEEP})`, color: "#0A0A0A" },
  { background: "linear-gradient(135deg, #3B3550, #1D1A28)" },
  { background: "linear-gradient(135deg, #6D28D9, #2E1065)" },
];
const avatar = { width: "38px", height: "38px", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: "700", border: "2px solid #12101A" } as const;

// offerUntil : date de fin du Pro offert, deja mise en forme (null une fois passee).
export default function Hero({ film, offerUntil }: { film: SiteFilm | null; offerUntil: string | null }) {
  // Carte et halos qui suivent la souris : une mise a jour par image au plus.
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  function onMove(e: MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = null; setPos({ x, y }); });
  }

  const { x: mx, y: my } = pos;
  const cardTf = `perspective(1400px) rotateY(${(mx * 10).toFixed(2)}deg) rotateX(${(-my * 8).toFixed(2)}deg) translate3d(${(mx * 18).toFixed(1)}px,${(my * 18).toFixed(1)}px,0)`;
  const blobTf = `translate3d(${(-mx * 70).toFixed(1)}px,${(-my * 70).toFixed(1)}px,0)`;
  const extra = film ? film.teamCount - film.team.length : 0;

  return (
    <section id="top" className={s.hero} onMouseMove={onMove} onMouseLeave={() => setPos({ x: 0, y: 0 })} style={{ position: "relative", marginTop: "-76px", padding: "190px 0 140px" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none" }}>
        <div className={s.tilt} style={{ position: "absolute", inset: "0", transform: blobTf }}>
          <div className={s.blob} style={{ width: "720px", height: "720px", left: "48%", top: "-160px", background: "var(--v)", opacity: "0.22" }}></div>
          <div className={s.blob} style={{ width: "520px", height: "520px", left: "72%", top: "300px", background: "var(--y)", opacity: "0.16", animationDelay: "-6s" }}></div>
          <div className={s.blob} style={{ width: "460px", height: "460px", left: "-8%", top: "380px", background: "var(--y)", opacity: "0.07", animationDelay: "-11s" }}></div>
        </div>
        <div style={{ position: "absolute", inset: "0", backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)", backgroundSize: "80px 80px", WebkitMaskImage: "radial-gradient(70% 60% at 50% 40%, #000, transparent)", maskImage: "radial-gradient(70% 60% at 50% 40%, #000, transparent)" }}></div>
        <div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "220px", background: "linear-gradient(180deg, transparent, var(--ink))" }}></div>
      </div>

      <div className={cx(s.g2, s.pad)} style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)", gap: "56px", alignItems: "center" }}>
        <div className={s.heroCol} style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
          {offerUntil && (
            <div className={cx(s.glass, s.in)} style={{ alignSelf: "flex-start", borderRadius: "999px", padding: "8px 16px 8px 10px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "500", color: "#E7E7EE", animationDelay: ".1s" }}>
              <span className={s.pulse} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--y)" }}></span>
              <span>Lancement privé · Pro offert jusqu&apos;au {offerUntil}</span>
            </div>
          )}
          <h1 className={s.h1} style={{ margin: "0", fontSize: "92px", lineHeight: "0.98", fontWeight: "700", letterSpacing: "-0.045em" }}>
            <span className={s.line}><span style={{ animationDelay: ".15s" }}>Découvre l&apos;œuvre.</span></span>
            <span className={s.line}><span className={cx(s.serif, s.sheen)} style={{ animationDelay: ".32s", fontSize: "1.08em" }}>Trouve le talent.</span></span>
          </h1>
          <p className={cx(s.in, s.heroP)} style={{ margin: "0", maxWidth: "520px", fontSize: "20px", lineHeight: "1.55", color: "var(--mut)", animationDelay: ".55s" }}>La plateforme où les jeunes talents du cinéma et de l&apos;audiovisuel se font repérer par leurs films. <span style={{ color: "#ffffff" }}>Pas par leur CV.</span></p>
          <div className={cx(s.in, s.ctaRow)} style={{ display: "flex", flexWrap: "wrap", gap: "12px", animationDelay: ".7s" }}>
            <a className={cx(s.btn, s["btn-y"])} href={APP.join}>Créer mon profil gratuit <Arrow /></a>
            <a className={cx(s.btn, s["btn-g"], s.glass)} href="#etapes"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15L19.5 12z"></path></svg> Voir comment ça marche</a>
          </div>
          <div className={cx(s.in, s.heroChecks)} style={{ display: "flex", flexWrap: "wrap", gap: "22px", fontSize: "13px", color: "var(--mut)", animationDelay: ".85s" }}>
            {["Gratuit pour commencer", "Films validés un par un", "Contact protégé"].map((t) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: "8px" }}><Check size={15} />{t}</span>
            ))}
          </div>
        </div>

        {/* Visuel : carte du film a la une */}
        <div className={s.in} style={{ position: "relative", animationDelay: ".45s" }}>
          <div className={s.tilt} style={{ transform: cardTf, transformStyle: "preserve-3d" }}>
            <div className={s.floaty} style={vars({ "--r": "-1.5deg" })}>
              <div className={cx(s.glass, s.heroCard)} style={{ borderRadius: "30px", padding: "14px" }}>
                <div className={cx(s.lbox, s.tone3, film?.poster && s.bare)} style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: "20px", overflow: "hidden" }}>
                  {film?.poster ? <Poster film={film} sizes="(max-width: 960px) 100vw, 560px" /> : (
                    <div style={{ position: "absolute", inset: "0", background: "radial-gradient(40% 55% at 72% 46%, color-mix(in srgb, var(--y) 38%, transparent), transparent 70%)" }}></div>
                  )}
                  <div style={{ position: "absolute", left: "0", right: "0", bottom: "9%", height: "42%", background: "linear-gradient(180deg, transparent, rgba(0,0,0,.75))" }}></div>
                  <div className={cx(s.mono, s.rec)} aria-hidden="true" style={{ position: "absolute", right: "14px", top: "calc(9% + 12px)", zIndex: "2", fontSize: "11px", color: "rgba(255,255,255,.7)" }}>REC ● 00:04:12:08</div>
                  {film?.example && <ExampleChip />}
                  {film && !film.example ? (
                    <a className={s.glass} href={APP.film(film.slug)} aria-label={`Voir le film ${film.title}`} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "76px", height: "76px", borderRadius: "50%", border: "0", cursor: "pointer", display: "grid", placeItems: "center", zIndex: "3" }}><Play size={24} /></a>
                  ) : (
                    <span className={s.glass} aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "76px", height: "76px", borderRadius: "50%", display: "grid", placeItems: "center", zIndex: "3" }}><Play size={24} /></span>
                  )}
                  {/* Fausse barre de lecture de la maquette : masquee sur une affiche (elle barrait son titre). */}
                  {!film?.poster && <div style={{ position: "absolute", left: "16px", right: "16px", bottom: "calc(9% + 14px)", zIndex: "2", height: "3px", borderRadius: "3px", background: "rgba(255,255,255,.18)" }}><div style={{ width: "38%", height: "100%", borderRadius: "3px", background: "var(--y)" }}></div></div>}
                </div>
                {film && (
                  <div style={{ padding: "18px 8px 6px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", color: "var(--mut)" }}><span style={{ padding: "4px 10px", borderRadius: "999px", background: "color-mix(in srgb, var(--v) 28%, transparent)", color: "#DCCFFF", fontWeight: "600" }}>{film.category}</span>{film.year && <span>{film.year}</span>}</div>
                        <div style={{ fontSize: "22px", fontWeight: "700", letterSpacing: "-0.02em" }}>{film.title}</div>
                        {film.director && <div style={{ fontSize: "13px", color: "var(--mut)" }}>Réalisé par {film.director}</div>}
                      </div>
                    </div>
                    {film.team.length > 0 && (
                      <>
                        <div style={{ height: "1px", background: "rgba(255,255,255,.08)" }}></div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            {film.team.map((initials, i) => (
                              <span key={i} style={{ ...avatar, ...AVATAR_BG[i % AVATAR_BG.length], marginLeft: i ? "-10px" : undefined }}>{initials}</span>
                            ))}
                            {extra > 0 && <span style={{ ...avatar, fontWeight: "600", color: "var(--mut)", background: "#17151F", marginLeft: "-10px" }}>+{extra}</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--mut)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 018 0v4"></path></svg>Crée ton profil gratuit pour voir les noms</div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={cx(s["hide-m"], s.floaty, s.glass)} style={{ position: "absolute", right: "-28px", top: "-36px", borderRadius: "20px", padding: "14px 18px 14px 14px", display: "flex", gap: "12px", alignItems: "center", animationDelay: "-2s", ...vars({ "--r": "3deg" }) }}>
            <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, var(--v), #4C1D95)", display: "grid", placeItems: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path></svg></span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "13px", fontWeight: "700" }}>Nouveau message</span><span style={{ fontSize: "12px", color: "var(--mut)" }}>Un producteur t&apos;a écrit</span></div>
          </div>

          {/* Badge sur le bord gauche, dans le haut de l'affiche : en bas il recouvrait le titre du
              film (carte d'exemple plus courte, sans equipe), et le bas d'une affiche porte souvent
              son propre titre. 88 px : entre la puce Exemple et le titre de l'affiche, flottement
              de 14 px compris, de 961 a 2048 px de large. */}
          <div className={cx(s["hide-m"], s.floaty, s.glass)} style={{ position: "absolute", left: "-44px", top: "88px", borderRadius: "20px", padding: "14px 18px 14px 14px", display: "flex", gap: "12px", alignItems: "center", animationDelay: "-4.5s", ...vars({ "--r": "-3deg" }) }}>
            <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--y)", display: "grid", placeItems: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l3 2.2 3.7-.1 1.1 3.5L22 10.5 21 14l1 3.5-3.2 1.9-1.1 3.5-3.7-.1L12 22l-3-2.2-3.7.1-1.1-3.5L1 14.5 2 11 1 7.5l3.2-1.9L5.3 2.1 9 2.2z"></path><path d="M8.5 12l2.3 2.3L15.5 9.5"></path></svg></span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "13px", fontWeight: "700" }}>Recruteur vérifié</span><span style={{ fontSize: "12px", color: "var(--mut)" }}>Compte vérifié par Unkast</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
