"use client";

// Sections a etat local de la page de vente : onglets Pour qui, tarifs, FAQ.
import { useState, type ReactNode } from "react";
import s from "./site.module.css";
import { APP, Arrow, Check, Poster, cx, type SiteFilm } from "./ui";

const g2 = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "56px", alignItems: "center" } as const;
const h3 = { margin: "0", fontSize: "44px", lineHeight: "1.05", fontWeight: "700", letterSpacing: "-0.03em" };
const pill = { padding: "7px 13px", borderRadius: "999px", background: "rgba(255,255,255,.08)", fontSize: "13px" };

function Bullets({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "17px", color: "#DADAE3" }}>
      {items.map((t) => (
        <div key={t} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}><span style={{ flexShrink: "0", width: "26px", height: "26px", borderRadius: "50%", background: "color-mix(in srgb, var(--y) 20%, transparent)", display: "grid", placeItems: "center" }}><Check size={13} width="3" /></span>{t}</div>
      ))}
    </div>
  );
}

function Panel({ tag, title, items, children }: { tag: string; title: string; items: string[]; children: ReactNode }) {
  return (
    <div className={cx(s.g2, s.swap)} style={g2}>
      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        <span className={s.mono} style={{ fontSize: "12px", color: "var(--y)" }}>{tag}</span>
        <h3 style={h3}>{title}</h3>
        <Bullets items={items} />
      </div>
      {/* Illustration de l'interface */}
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

const TABS = [
  { id: "talents", label: "Talents" },
  { id: "createurs", label: "Créateurs" },
  { id: "recruteurs", label: "Recruteurs" },
] as const;

function ResultRow({ tone }: { tone: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px", borderRadius: "16px", background: "rgba(255,255,255,.05)" }}><span className={tone} style={{ width: "84px", aspectRatio: "16 / 10", borderRadius: "10px", flexShrink: "0" }}></span><div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "3px" }}><span style={{ fontSize: "15px", fontWeight: "600" }}>Chef opérateur</span><span style={{ fontSize: "13px", color: "var(--mut)" }}>Paris</span></div><span style={{ padding: "7px 12px", borderRadius: "999px", background: "color-mix(in srgb, var(--v) 30%, transparent)", fontSize: "12px", fontWeight: "600", color: "#E2D9FF" }}>Écrire</span></div>
  );
}

export function Audience({ film }: { film: SiteFilm | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("talents");
  return (
    <section id="pourqui" className={s.pad} style={{ maxWidth: "1240px", margin: "0 auto", padding: "80px 32px 160px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px", textAlign: "center", marginBottom: "56px" }}>
        <h2 className={cx(s.h2, s.rv)} style={{ margin: "0", fontSize: "72px", lineHeight: "1", fontWeight: "700", letterSpacing: "-0.045em" }}>Pensé pour <span className={s.serif} style={{ color: "var(--y)" }}>chaque métier.</span></h2>
        <div className={cx(s.glass, s.rv)} role="group" aria-label="Choisir un profil" style={{ display: "inline-flex", gap: "4px", padding: "5px", borderRadius: "999px" }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={cx(s.tab, tab === t.id && s.on)} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className={cx(s.glass, s.rv)} style={{ borderRadius: "40px", padding: "56px", overflow: "hidden" }}>
        {tab === "talents" && (
          <Panel tag="COMÉDIENS · TECHNICIENS · CRÉATIFS" title="Ton travail parle pour toi." items={["Un profil avec tes métiers, ta bio et ton parcours", "Tes films et tous les projets où tu es crédité", "Tu réponds gratuitement à tous les messages reçus"]}>
            <div className={s.glass} style={{ borderRadius: "28px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px", background: "linear-gradient(160deg, color-mix(in srgb, var(--v) 11%, transparent), rgba(255,255,255,.03))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}><span style={{ width: "68px", height: "68px", borderRadius: "50%", background: "conic-gradient(from 200deg, var(--v), var(--y), var(--v))", padding: "3px", boxSizing: "border-box" }}><span style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", background: "#16131F" }}></span></span><div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "20px", fontWeight: "700" }}>Ton nom</span><span style={{ fontSize: "13px", color: "var(--mut)" }}>Ta ville</span></div><span style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: "999px", background: "color-mix(in srgb, var(--y) 18%, transparent)", color: "var(--y)", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--y)" }}></span>Disponible</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}><span style={pill}>Comédien</span><span style={pill}>Voix off</span><span style={pill}>Scénariste</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}><span className={s.tone1} style={{ aspectRatio: "16 / 10", borderRadius: "10px" }}></span><span className={s.tone2} style={{ aspectRatio: "16 / 10", borderRadius: "10px" }}></span><span className={s.tone4} style={{ aspectRatio: "16 / 10", borderRadius: "10px" }}></span></div>
            </div>
          </Panel>
        )}
        {tab === "createurs" && (
          <Panel tag="RÉALISATEURS · PRODUCTEURS" title="Mets ton film et ton équipe en lumière." items={["Publie tes films dans un catalogue exigeant", "Gère les crédits et invite tes collaborateurs", "Repère tes futurs talents dans le générique des autres"]}>
            <div className={s.glass} style={{ borderRadius: "28px", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className={cx(s.lbox, s.tone2)} style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: "18px", overflow: "hidden" }}>
                {film && <Poster film={film} sizes="(max-width: 960px) 100vw, 520px" />}
                {film && <>
                  <div style={{ position: "absolute", left: "0", right: "0", bottom: "9%", height: "50%", background: "linear-gradient(180deg, transparent, rgba(0,0,0,.75))" }}></div>
                  <span style={{ position: "absolute", left: "14px", right: "14px", bottom: "calc(9% + 12px)", zIndex: "2", fontSize: "18px", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{film.title}</span>
                </>}
                <span style={{ position: "absolute", right: "14px", top: "calc(9% + 12px)", zIndex: "2", padding: "5px 11px", borderRadius: "999px", background: "rgba(0,0,0,.5)", fontSize: "12px", fontWeight: "600", color: "var(--y)" }}>Responsable du film</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px 8px", fontSize: "14px" }}><span style={{ color: "var(--mut)" }}>Générique</span><span style={{ display: "flex" }}>{["var(--v)", "var(--y)", "#3B3550", "#6D28D9"].map((c, i) => <span key={c} style={{ width: "28px", height: "28px", borderRadius: "50%", background: c, border: "2px solid #15131C", marginLeft: i ? "-8px" : undefined }}></span>)}</span></div>
            </div>
          </Panel>
        )}
        {tab === "recruteurs" && (
          <Panel tag="CASTING · PRODUCTION" title="Trouve la bonne personne en regardant son travail." items={["Recherche par métier et par catégorie", "Compte recruteur vérifié à la main par Unkast", "Badge Recruteur vérifié avec le Pro, après vérification par Unkast"]}>
            <div className={s.glass} style={{ borderRadius: "28px", padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "52px", padding: "0 16px", borderRadius: "14px", background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.1)" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--mut)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path></svg><span style={{ fontSize: "15px" }}>Chef opérateur</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}><span style={{ ...pill, background: "var(--y)", color: "#0A0A0A", fontWeight: "600" }}>Court métrage</span><span style={pill}>Paris</span><span style={pill}>Disponible</span></div>
              <ResultRow tone={s.tone1} />
              <ResultRow tone={s.tone4} />
            </div>
          </Panel>
        )}
      </div>
    </section>
  );
}

// Prix affiches. Annuel : null tant qu'il n'est pas fixe, ce qui masque la bascule
// Mensuel / Annuel. Le renseigner (ex. "99,90 €") la reactive.
const PRO_MONTHLY_PRICE = "9,99 €";
const PRO_ANNUAL_PRICE: string | null = null;

export type PricingLimits = { freeFilms: number; freeContacts: number; dailyConversations: number };

const priceStyle = { fontSize: "60px", fontWeight: "700", letterSpacing: "-0.04em", lineHeight: "1" };
const perStyle = { fontSize: "18px", fontWeight: "500", color: "var(--mut)", letterSpacing: "0" };

export function Pricing({ offerUntil, limits }: { offerUntil: string | null; limits: PricingLimits }) {
  const [annual, setAnnual] = useState(false);
  const showAnnual = annual && PRO_ANNUAL_PRICE !== null;
  const free = ["Profil complet", `Jusqu'à ${limits.freeFilms} films publiés`, "Équipes et profils visibles", `Contacter ${limits.freeContacts} personnes`, "Recevoir et répondre aux messages"];
  const pro = ["Tout le gratuit, plus :", "Films illimités", `Contacte autant de personnes que tu veux, ${limits.dailyConversations} nouvelles conversations par jour`, "Badge Recruteur vérifié, après vérification par Unkast"];

  return (
    <section id="tarifs" style={{ position: "relative", padding: "60px 0 170px" }}>
      <div aria-hidden="true" className={s.blob} style={{ width: "800px", height: "500px", left: "50%", top: "200px", marginLeft: "-400px", background: "var(--y)", opacity: ".07" }}></div>
      <div className={s.pad} style={{ position: "relative", maxWidth: "1040px", margin: "0 auto", padding: "0 32px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "24px", marginBottom: "48px" }}>
          <h2 className={cx(s.h2, s.rv)} style={{ margin: "0", fontSize: "72px", lineHeight: "1", fontWeight: "700", letterSpacing: "-0.045em" }}>Commence gratuit. <span className={s.serif} style={{ color: "var(--y)" }}>Passe Pro</span> quand tu veux.</h2>
          {PRO_ANNUAL_PRICE !== null && (
            <div className={cx(s.glass, s.rv)} role="group" aria-label="Période de facturation" style={{ display: "inline-flex", gap: "4px", padding: "5px", borderRadius: "999px" }}>
              <button type="button" className={cx(s.tab, !annual && s.on)} aria-pressed={!annual} onClick={() => setAnnual(false)}>Mensuel</button>
              <button type="button" className={cx(s.tab, annual && s.on)} aria-pressed={annual} onClick={() => setAnnual(true)}>Annuel</button>
            </div>
          )}
        </div>

        {offerUntil && (
          <div className={cx(s.glass, s["glass-v"], s.rv)} style={{ borderRadius: "24px", padding: "18px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}><span style={{ width: "42px", height: "42px", borderRadius: "12px", background: "var(--y)", display: "grid", placeItems: "center", flexShrink: "0" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12v9H4v-9"></path><path d="M2 7h20v5H2z"></path><path d="M12 21V7"></path><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"></path></svg></span><div style={{ display: "flex", flexDirection: "column", gap: "3px" }}><span style={{ fontSize: "16px", fontWeight: "700" }}>Offre de lancement</span><span style={{ fontSize: "14px", color: "#DCD3F5" }}>Pro offert à tous les inscrits jusqu&apos;au {offerUntil}.</span></div></div>
          </div>
        )}

        <div className={s.g2} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "20px" }}>
          <div className={cx(s.rv, s.glass)} style={{ borderRadius: "32px", padding: "40px", display: "flex", flexDirection: "column", gap: "26px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "15px", fontWeight: "600", color: "var(--mut)" }}>Gratuit</span><span style={priceStyle}>0 €</span><span style={{ fontSize: "14px", color: "var(--mut)" }}>Pour toujours</span></div>
            <div style={{ height: "1px", background: "rgba(255,255,255,.08)" }}></div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "16px", color: "#DADAE3" }}>
              {free.map((t) => <span key={t} style={{ display: "flex", gap: "12px", alignItems: "center" }}><Check stroke="var(--mut)" />{t}</span>)}
            </div>
            <a className={cx(s.btn, s["btn-g"], s.glass)} href={APP.join} style={{ marginTop: "auto" }}>Commencer gratuitement</a>
          </div>

          <div className={s.rv2} style={{ position: "relative", borderRadius: "32px", padding: "1.5px", background: "linear-gradient(140deg, var(--y), color-mix(in srgb, var(--v) 80%, transparent) 55%, var(--y))" }}>
            <div style={{ position: "relative", borderRadius: "31px", padding: "40px", display: "flex", flexDirection: "column", gap: "26px", height: "100%", boxSizing: "border-box", background: "radial-gradient(90% 60% at 100% 0%, color-mix(in srgb, var(--v) 20%, transparent), transparent 60%), #111111", overflow: "hidden" }}>
              <span style={{ position: "absolute", right: "24px", top: "24px", padding: "6px 12px", borderRadius: "999px", background: "var(--y)", color: "#0A0A0A", fontSize: "12px", fontWeight: "700" }}>Recommandé</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "15px", fontWeight: "600", color: "var(--vl)" }}>Pro</span>
                {showAnnual
                  ? <span key="an" className={s.swap} style={priceStyle}>{PRO_ANNUAL_PRICE}<span style={perStyle}> / an</span></span>
                  : <span key="mois" className={s.swap} style={priceStyle}>{PRO_MONTHLY_PRICE}<span style={perStyle}> / mois</span></span>}
                <span style={{ fontSize: "14px", color: "var(--mut)" }}>Sans engagement</span></div>
              <div style={{ height: "1px", background: "rgba(255,255,255,.1)" }}></div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "16px" }}>
                {pro.map((t) => <span key={t} style={{ display: "flex", gap: "12px", alignItems: "center" }}><span style={{ flexShrink: "0", display: "flex" }}><Check width="2.6" /></span>{t}</span>)}
              </div>
              <a className={cx(s.btn, s["btn-y"])} href={APP.pro} style={{ marginTop: "auto" }}>Passer Pro <Arrow /></a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = (limits: PricingLimits) => [
  { q: "Unkast, c'est pour qui ?", a: "Pour les jeunes talents du cinéma et de l'audiovisuel : comédiens, techniciens, réalisateurs, producteurs. Et pour ceux qui les cherchent : directeurs de casting, producteurs, réalisateurs." },
  { q: "C'est vraiment gratuit ?", a: `Oui. Profil complet, jusqu'à ${limits.freeFilms} films, ${limits.freeContacts} personnes contactées, et tu réponds à tous les messages sans payer. Le Pro sert à publier sans limite et à contacter autant de personnes que tu veux.` },
  { q: "Qui peut publier un film ?", a: "Tout membre, en déclarant son rôle sur le film (réalisateur, producteur, ayant droit ou autre) et en confirmant détenir les droits de diffusion ou l'accord de leur détenteur. Un seul responsable par film, qui peut ajouter des co-gestionnaires." },
  { q: "Pourquoi les films sont validés ?", a: "Pour garder un catalogue de qualité. L'équipe Unkast regarde chaque film avant de le rendre visible. C'est ce qui fait la valeur de ton profil." },
  { q: "Mes coordonnées sont visibles ?", a: "Non. Elles ne sont jamais affichées sur ton profil. Le premier contact passe par la messagerie Unkast, qui bloque les coordonnées dans les premiers messages pour éviter les arnaques. Ensuite, vous échangez comme vous voulez." },
];

export function Faq({ limits }: { limits: PricingLimits }) {
  const [open, setOpen] = useState(0);
  return (
    <section className={s.pad} style={{ maxWidth: "900px", margin: "0 auto", padding: "20px 32px 160px", boxSizing: "border-box" }}>
      <h2 className={cx(s.h2, s.rv)} style={{ margin: "0 0 40px", fontSize: "56px", lineHeight: "1", fontWeight: "700", letterSpacing: "-0.04em", textAlign: "center" }}>Questions <span className={s.serif} style={{ color: "var(--y)" }}>fréquentes</span></h2>
      <div className={s.rv} style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
        {FAQ(limits).map((item, i) => (
          <div key={item.q} style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
            <button type="button" className={s["faq-btn"]} aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>{item.q}<span aria-hidden="true" style={{ flexShrink: "0", width: "36px", height: "36px", borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(255,255,255,.06)", transition: "transform .5s cubic-bezier(.2,.8,.2,1)", transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg></span></button>
            {open === i && <p id={`faq-${i}`} className={s.swap} style={{ margin: "0", padding: "0 60px 28px 0", fontSize: "17px", lineHeight: "1.65", color: "var(--mut)" }}>{item.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
