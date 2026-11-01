// Sections sans etat de la page de vente (composants serveur).
import type { CSSProperties } from "react";
import s from "./site.module.css";
import { APP, Eyebrow, LIME_DEEP, Play, Poster, TONES, cx, type SiteFilm } from "./ui";

export function Nav() {
  return (
    <div style={{ position: "sticky", top: "16px", zIndex: "50", display: "flex", justifyContent: "center", padding: "0 16px" }}>
      <nav className={cx(s.glass, s.in)} style={{ width: "100%", maxWidth: "1180px", borderRadius: "999px", padding: "10px 10px 10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", boxSizing: "border-box" }}>
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "#ffffff" }}>
          <span style={{ width: "26px", height: "26px", borderRadius: "8px", background: "var(--y)", display: "grid", placeItems: "center", boxShadow: "0 0 24px color-mix(in srgb, var(--y) 60%, transparent)" }}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9L10.5 6z" fill="#0A0A0A"></path></svg></span>
          <span style={{ fontWeight: "800", fontSize: "19px", letterSpacing: "0.16em" }}>UNKAST</span>
        </a>
        <div className={s["hide-m"]} style={{ display: "flex", gap: "2px" }}>
          <a className={s["nav-a"]} href="#concept">Le concept</a>
          <a className={s["nav-a"]} href="#etapes">Comment ça marche</a>
          <a className={s["nav-a"]} href="#pourqui">Pour qui</a>
          <a className={s["nav-a"]} href="#tarifs">Tarifs</a>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <a className={cx(s["nav-a"], s["hide-m"])} href={APP.login}>Se connecter</a>
          <a className={cx(s.btn, s["btn-y"])} href={APP.join} style={{ minHeight: "44px", padding: "0 20px", fontSize: "14px" }}>Rejoindre</a>
        </div>
      </nav>
    </div>
  );
}

const ROLE_NAMES = ["Réalisatrice", "Chef opérateur", "Monteuse", "Comédien", "Ingé son", "Scénariste", "Productrice", "Étalonneur", "Compositrice", "Directeur de casting"];

export function RolesMarquee() {
  // Liste doublee : la boucle defile de -50 % sans saut.
  const roles = [...ROLE_NAMES, ...ROLE_NAMES];
  return (
    <section aria-label="Métiers présents sur Unkast" style={{ padding: "10px 0 40px", borderTop: "1px solid rgba(255,255,255,.06)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <div className={s["mq-wrap"]} style={{ padding: "26px 0" }}>
        <div className={s.mq} style={{ gap: "48px", alignItems: "center", fontSize: "30px", fontWeight: "600", letterSpacing: "-0.02em", color: "rgba(255,255,255,.82)" }}>
          {roles.map((label, i) => (
            <span key={i} aria-hidden={i >= ROLE_NAMES.length || undefined} style={{ display: "flex", alignItems: "center", gap: "48px", whiteSpace: "nowrap" }}><span className={i % 3 === 1 ? s.serif : undefined}>{label}</span><span style={{ color: "var(--y)", fontSize: "18px" }}>✦</span></span>
          ))}
        </div>
      </div>
    </section>
  );
}

const W = (words: string, cls?: string, style?: CSSProperties) =>
  words.split(" ").map((w, i) => (
    <span key={i}>{i > 0 && " "}<span className={cx(s.w, cls)} style={style}>{w}</span></span>
  ));

export function Manifesto() {
  const card = { borderRadius: "26px", padding: "30px", display: "flex", flexDirection: "column", gap: "14px" } as const;
  const tag = { fontSize: "12px", color: "var(--y)" };
  const title = { fontSize: "22px", fontWeight: "700", letterSpacing: "-0.02em" };
  const body = { fontSize: "16px", lineHeight: "1.6", color: "var(--mut)" };
  return (
    <section id="concept" className={s.pad} style={{ maxWidth: "1240px", margin: "0 auto", padding: "170px 32px 150px", boxSizing: "border-box" }}>
      <Eyebrow style={{ marginBottom: "40px" }}>Le concept</Eyebrow>
      <p className={s.mani} style={{ margin: "0", fontSize: "74px", lineHeight: "1.06", fontWeight: "600", letterSpacing: "-0.04em", maxWidth: "1150px" }}>
        {W("Un CV dit ce que tu as fait.")}{" "}
        {W("Un film montre ce que tu sais faire.", s.serif, { color: "var(--y)" })}
      </p>
      <div className={s.g3} style={{ marginTop: "90px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "20px" }}>
        <div className={cx(s.rv, s.glass)} style={card}>
          <span className={s.mono} style={tag}>01 · ON REGARDE</span>
          <span style={title}>Le travail d&apos;abord</span>
          <span style={body}>Chaque profil se juge sur des films réels, visibles en entier. Pas sur des lignes de CV.</span>
        </div>
        <div className={cx(s.rv2, s.glass)} style={card}>
          <span className={s.mono} style={tag}>02 · ON DÉCOUVRE</span>
          <span style={title}>Toute l&apos;équipe derrière</span>
          <span style={body}>Un film te plaît ? Tu remontes le générique et tu tombes sur chaque personne qui l&apos;a fait.</span>
        </div>
        <div className={cx(s.rv, s.glass, s["glass-v"])} style={card}>
          <span className={s.mono} style={tag}>03 · ON SE PARLE</span>
          <span style={title}>Le bon contact, direct</span>
          <span style={{ ...body, color: "#D9D2EE" }}>Tu écris à la bonne personne en un clic, via une messagerie pensée pour les pros.</span>
        </div>
      </div>
    </section>
  );
}

// Pastilles floues de la maquette : decor, pas des personnes.
const DOTS = [["var(--v)", "var(--y)", "#3B3550"], ["var(--y)", "var(--v)", "#3B3550"]];

function FilmCard({ film, tone, dots, copy }: { film: SiteFilm; tone: string; dots: string[]; copy?: boolean }) {
  return (
    <a href={APP.film(film.slug)} aria-hidden={copy || undefined} tabIndex={copy ? -1 : undefined} className={cx(s.card, s.glass)} style={{ width: "340px", borderRadius: "24px", padding: "10px", flexShrink: "0", color: "inherit", textDecoration: "none" }}>
      <div className={cx(s.lbox, tone)} style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: "16px", overflow: "hidden" }}>
        <Poster film={film} sizes="340px" />
        <span style={{ position: "absolute", left: "12px", top: "calc(9% + 10px)", zIndex: "2", padding: "5px 11px", borderRadius: "999px", background: "rgba(0,0,0,.45)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", fontSize: "12px", fontWeight: "600" }}>{film.category}</span>
        <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "46px", height: "46px", borderRadius: "50%", background: "rgba(255,255,255,.14)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", display: "grid", placeItems: "center" }}><Play /></span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 8px 6px" }}>
        <span style={{ fontSize: "15px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{film.title}</span>
        <span aria-hidden="true" style={{ display: "flex", flexShrink: "0" }}>
          {dots.map((c, i) => <span key={i} style={{ width: "24px", height: "24px", borderRadius: "50%", background: c, marginLeft: i ? "-7px" : undefined, filter: "blur(1.5px)" }}></span>)}
        </span>
      </div>
    </a>
  );
}

// Nombre minimal de films pour afficher le catalogue (deux rangees qui defilent).
export const CATALOGUE_MIN_FILMS = 6;

export function Catalogue({ films }: { films: SiteFilm[] }) {
  if (films.length < CATALOGUE_MIN_FILMS) return null;
  const half = Math.ceil(films.length / 2);
  const rows = [films.slice(0, half), films.slice(half).concat(films.slice(0, half)).slice(0, half)];
  return (
    <section style={{ padding: "60px 0 170px", position: "relative" }}>
      <div aria-hidden="true" className={s.blob} style={{ width: "700px", height: "400px", left: "30%", top: "120px", background: "var(--v)", opacity: ".1" }}></div>
      <div className={cx(s.g2, s.pad)} style={{ position: "relative", maxWidth: "1240px", margin: "0 auto 64px", padding: "0 32px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "40px", alignItems: "end" }}>
        <h2 className={cx(s.h2, s.rv)} style={{ margin: "0", fontSize: "64px", lineHeight: "1", fontWeight: "700", letterSpacing: "-0.04em" }}>Des films,<br /><span className={s.serif} style={{ color: "var(--y)" }}>pas des fiches.</span></h2>
        <p className={s.rv} style={{ margin: "0", fontSize: "18px", lineHeight: "1.6", color: "var(--mut)", maxWidth: "460px" }}>Court métrage, clip, documentaire, pub, bande démo, extrait de scène. Chaque film est validé à la main avant sa mise en ligne. C&apos;est ce qui donne de la valeur à ton profil.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "22px", position: "relative" }}>
        {rows.map((row, r) => (
          <div key={r} className={s["mq-wrap"]}>
            <div className={cx(s.mq, r === 1 && s.rev)} style={{ gap: "22px", padding: "12px 0" }}>
              {/* Rangee doublee pour la boucle ; la copie est cachee aux lecteurs d'ecran. */}
              {[...row, ...row].map((film, i) => (
                <FilmCard key={i} film={film} tone={TONES[(i + r * 2) % 4]} dots={DOTS[r]} copy={i >= row.length} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const stepBox = { position: "sticky", borderRadius: "36px", padding: "48px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "48px", alignItems: "center", minHeight: "440px", boxSizing: "border-box" } as const;
const stepNum = { fontSize: "80px", lineHeight: "1", fontWeight: "500", color: "transparent", WebkitTextStroke: "1px color-mix(in srgb, var(--y) 70%, transparent)" };
const stepH3 = { margin: "0", fontSize: "40px", fontWeight: "700", letterSpacing: "-0.03em" };
const stepP = { margin: "0", fontSize: "18px", lineHeight: "1.6", color: "var(--mut)", maxWidth: "440px" };
const chip = { padding: "8px 14px", borderRadius: "999px", background: "rgba(255,255,255,.07)", fontSize: "13px", color: "var(--mut)" };

function CreditRow({ role, avatar, status, invited }: { role: string; avatar?: CSSProperties; status: string; invited?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px", borderRadius: "14px", ...(invited ? { border: "1px dashed rgba(255,255,255,.22)" } : { background: "rgba(255,255,255,.04)" }) }}>
      {invited ? (
        <span style={{ width: "40px", height: "40px", borderRadius: "50%", border: "1px dashed rgba(255,255,255,.35)", display: "grid", placeItems: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mut)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16v12H4z"></path><path d="M4 7l8 6 8-6"></path></svg></span>
      ) : (
        <span style={{ width: "40px", height: "40px", borderRadius: "50%", ...avatar }}></span>
      )}
      <span style={{ flex: "1", fontSize: "15px", fontWeight: "600" }}>{role}</span>
      <span style={{ fontSize: "12px", fontWeight: "600", color: invited ? "var(--vl)" : "var(--y)" }}>{status}</span>
    </div>
  );
}

export function Steps() {
  return (
    <section id="etapes" className={s.pad} style={{ maxWidth: "1240px", margin: "0 auto", padding: "60px 32px 120px", boxSizing: "border-box" }}>
      <div style={{ textAlign: "center", marginBottom: "80px", display: "flex", flexDirection: "column", alignItems: "center", gap: "22px" }}>
        <Eyebrow both>Comment ça marche</Eyebrow>
        <h2 className={cx(s.h2, s.rv)} style={{ margin: "0", fontSize: "72px", lineHeight: "1", fontWeight: "700", letterSpacing: "-0.045em" }}>Trois étapes. <span className={s.serif} style={{ color: "var(--y)" }}>Zéro CV.</span></h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
        <div className={cx(s.step, s.glass, s.g2)} style={{ ...stepBox, top: "110px", background: "linear-gradient(145deg, rgba(26,26,26,.94), rgba(14,14,14,.96))" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <span className={s.mono} style={stepNum}>01</span>
            <h3 style={stepH3}>Publie ton film</h3>
            <p style={stepP}>Colle ton lien Vimeo ou YouTube, choisis la catégorie, déclare ton rôle sur le film. L&apos;équipe Unkast valide chaque film à la main avant sa mise en ligne.</p>
          </div>
          {/* Illustration de l'interface, pas un vrai formulaire. */}
          <div className={s.glass} aria-hidden="true" style={{ borderRadius: "24px", padding: "26px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <span style={{ fontSize: "13px", color: "var(--mut)" }}>Lien de ton film</span>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "0 16px", minHeight: "52px", borderRadius: "14px", background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.1)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mut)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"></path><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"></path></svg><span className={s.mono} style={{ flex: "1", color: "#ffffff", fontSize: "15px", fontWeight: "500", minWidth: "0" }}>vimeo.com/ton-film</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}><span style={{ ...chip, background: "var(--y)", color: "#0A0A0A", fontWeight: "600" }}>Court métrage</span><span style={chip}>Clip</span><span style={chip}>Documentaire</span><span style={chip}>Publicité</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "14px", background: "color-mix(in srgb, var(--v) 18%, transparent)", fontSize: "14px", color: "#E2D9FF" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>En cours de validation par l&apos;équipe Unkast</div>
          </div>
        </div>

        <div className={cx(s.step, s.glass, s.g2)} style={{ ...stepBox, top: "138px", background: "linear-gradient(145deg, rgba(26,23,34,.95), rgba(14,14,16,.96))" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <span className={s.mono} style={stepNum}>02</span>
            <h3 style={stepH3}>Crédite ton équipe</h3>
            <p style={stepP}>Chaque personne qui a bossé sur le film apparaît au générique. Pas encore inscrite ? Elle reçoit une invitation et récupère son crédit en arrivant.</p>
          </div>
          <div className={s.glass} aria-hidden="true" style={{ borderRadius: "24px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <CreditRow role="Cheffe opératrice" status="Sur Unkast" avatar={{ background: "linear-gradient(135deg, var(--v), #4C1D95)" }} />
            <CreditRow role="Montage" status="Sur Unkast" avatar={{ background: `linear-gradient(135deg, var(--y), ${LIME_DEEP})` }} />
            <CreditRow role="Ingé son" status="Invitation envoyée" invited />
            <span className={cx(s.btn, s["btn-g"])} style={{ marginTop: "6px", background: "rgba(255,255,255,.06)", minHeight: "48px", fontSize: "14px" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>Ajouter un collaborateur</span>
          </div>
        </div>

        <div className={cx(s.step, s.glass, s.g2)} style={{ ...stepBox, top: "166px", background: "linear-gradient(145deg, rgba(28,34,10,.95), rgba(14,15,11,.97))" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <span className={s.mono} style={stepNum}>03</span>
            <h3 style={stepH3}>Fais-toi repérer</h3>
            <p style={stepP}>Producteurs, directeurs de casting, réalisateurs. Ils regardent, ils aiment, ils t&apos;écrivent directement sur Unkast. Répondre est toujours gratuit.</p>
          </div>
          <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className={s.glass} style={{ alignSelf: "flex-start", maxWidth: "340px", borderRadius: "22px 22px 22px 6px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "12px", color: "var(--vl)", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>Productrice <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--y)" aria-hidden="true"><path d="M12 2l2.6 2 3.3-.2.9 3.2 2.7 2-1 3.1 1 3.1-2.7 2-.9 3.2-3.3-.2L12 22l-2.6-2-3.3.2-.9-3.2-2.7-2 1-3.1-1-3.1 2.7-2 .9-3.2 3.3.2z"></path></svg></span><span style={{ fontSize: "15px", lineHeight: "1.5" }}>J&apos;ai vu ton court. Le travail sur la lumière est top. Tu serais dispo en mars ?</span></div>
            <div style={{ alignSelf: "flex-end", maxWidth: "300px", borderRadius: "22px 22px 6px 22px", padding: "16px 18px", background: "var(--y)", color: "#0A0A0A", fontSize: "15px", lineHeight: "1.5", fontWeight: "500" }}>Avec plaisir, on s&apos;appelle cette semaine ?</div>
            <div style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--mut)", marginTop: "6px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>Premier contact par la messagerie Unkast</div>
          </div>
        </div>
      </div>
    </section>
  );
}
