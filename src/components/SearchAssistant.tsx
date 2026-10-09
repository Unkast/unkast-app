"use client";

// Assistant de recherche (lot 8) : panneau ouvert depuis la barre de recherche
// (clic, Ctrl K) ou la loupe de l'en-tête mobile. Sans IA : raccourcis, parcours
// guidés à une question à la fois, saisie libre reconnue par src/lib/assistant.ts,
// réponses toutes faites.
//
// Sécurité et vie privée : il ne lit que POST /api/search (données publiques, RLS
// et droits par colonne inchangés). Ce qui est tapé part dans le CORPS de la
// requête, jamais dans une adresse, et n'est gardé nulle part (ni stockage local,
// ni historique). L'état disparaît à la fermeture : le composant est démonté.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import FilmPoster from "@/components/FilmPoster";
import {
  CATEGORY_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  PLAYING_AGES,
  PLAYING_AGE_LABELS,
  ROLES_BY_CATEGORY,
} from "@/lib/constants";
import {
  ACTOR_ROLES,
  ANY,
  FAQS,
  TECH_FAMILIES,
  TOP_CITIES,
  hasSearch,
  normalize,
  parseQuery,
  searchBodyFromQuery,
  type Faq,
  type FaqId,
  type SearchBody,
} from "@/lib/assistant";
import type { ProjectCategory } from "@/types/database";

interface Props {
  onClose: () => void;
  isLoggedIn: boolean;
}

type Talent = { id: string; full_name: string; slug: string; avatar_url: string | null; location: string | null; roles: string[]; project_count: number };
type Film = { id: string; title: string; slug: string; category: ProjectCategory; year: number; director_name: string; poster_url: string | null; preview_url: string | null };
type Results = { talents: Talent[]; projects: Film[] };

type FlowKind = "actor" | "tech";
type View =
  | { name: "home" }
  | { name: "flow"; kind: FlowKind; answers: Record<string, string> }
  | { name: "faq"; id: FaqId | "all" }
  | { name: "news" };

type Step = { key: string; question: string; options: { value: string; label: string }[]; freeText?: boolean };

// Une question à la fois. Chaque question accepte « Peu importe » (ANY).
function stepsFor(kind: FlowKind, answers: Record<string, string>): Step[] {
  const city: Step = { key: "city", question: "Dans quelle ville ?", options: TOP_CITIES.map((c) => ({ value: c, label: c })), freeText: true };
  const language: Step = { key: "language", question: "Quelle langue parlée ?", options: LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] })) };
  if (kind === "actor") {
    return [
      { key: "roleType", question: "Pour quel type de rôle ?", options: [{ value: "femme", label: "Rôles féminins" }, { value: "homme", label: "Rôles masculins" }] },
      city,
      { key: "age", question: "Quel âge de jeu ?", options: PLAYING_AGES.map((a) => ({ value: a, label: PLAYING_AGE_LABELS[a] })) },
      language,
    ];
  }
  const family = answers.family;
  return [
    { key: "family", question: "Dans quel domaine ?", options: TECH_FAMILIES.map((f) => ({ value: f, label: f })) },
    // Le métier précis ne se demande que si un domaine a été choisi.
    ...(family && family !== ANY ? [{ key: "role", question: "Quel métier ?", options: ROLES_BY_CATEGORY[family].map((r) => ({ value: r, label: r })) }] : []),
    city,
    language,
  ];
}

function flowBody(kind: FlowKind, answers: Record<string, string>): SearchBody | null {
  const picked = (key: string) => (answers[key] && answers[key] !== ANY ? answers[key] : undefined);
  const body: SearchBody = { type: "talents" };
  if (kind === "actor") {
    body.roles = ACTOR_ROLES;
    const roleType = picked("roleType");
    if (roleType === "femme" || roleType === "homme") body.role_type = roleType;
    body.playing_age = picked("age");
  } else {
    if (!answers.family) return null; // rien à chercher avant la première réponse
    const role = picked("role");
    const family = picked("family");
    body.roles = role ? [role] : family ? ROLES_BY_CATEGORY[family] : TECH_FAMILIES.flatMap((f) => ROLES_BY_CATEGORY[f]);
  }
  body.location = picked("city");
  body.language = picked("language");
  return body;
}

function flowCrumbs(kind: FlowKind, answers: Record<string, string>): string[] {
  const root = kind === "tech" ? "Technicien" : answers.roleType === "femme" ? "Comédienne" : answers.roleType === "homme" ? "Comédien" : "Comédien ou comédienne";
  const crumbs = [root];
  for (const step of stepsFor(kind, answers)) {
    const value = answers[step.key];
    if (!value || value === ANY || step.key === "roleType") continue;
    crumbs.push(step.options.find((o) => o.value === value)?.label ?? value);
  }
  return crumbs;
}

// ---- Éléments navigables au clavier ------------------------------------------

type Item = {
  id: string;
  run: () => void;
  /** Ligne avec icône, bouton d'une question, ou résultat (profil / film). */
  render: (active: boolean) => ReactNode;
  chip?: boolean;
};
type Section = { key: string; title?: string; chips?: boolean; before?: ReactNode; items: Item[]; after?: ReactNode };

const ICONS = {
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  camera: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></>,
  star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
};
function Icon({ name, className = "size-[18px]" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const ROW = "flex min-h-[52px] w-full items-center gap-3.5 rounded-[14px] px-2.5 text-left text-[15px] text-text-primary";
const ROW_ON = "bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]";

function row(icon: keyof typeof ICONS, label: string, sub?: string) {
  return function Row(active: boolean) {
    return (
      <span className={`${ROW} ${active ? ROW_ON : ""}`}>
        <span className={`flex size-[34px] shrink-0 items-center justify-center rounded-[10px] ${active ? "bg-lime text-canvas" : "bg-white/[0.07] text-text-secondary"}`}>
          <Icon name={icon} />
        </span>
        <span className="min-w-0">
          <span className="block truncate">{label}</span>
          {sub && <span className="block truncate text-[13px] text-text-secondary">{sub}</span>}
        </span>
        {active && <span className="ml-auto shrink-0 text-xs text-text-secondary max-lg:hidden">Entrée</span>}
      </span>
    );
  };
}

function chip(label: string, selected = false) {
  return function ChipItem(active: boolean) {
    return (
      <span className={`inline-flex min-h-10 items-center rounded-pill border px-4 text-sm font-medium ${selected ? "border-lime/50 bg-lime/15 text-lime" : active ? "border-white/40 bg-white/15 text-text-primary" : "border-white/[0.11] bg-white/[0.05] text-text-secondary"}`}>
        {label}
      </span>
    );
  };
}

function FaqCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-2 mb-2 rounded-[18px] bg-white/[0.05] px-[18px] py-4 text-sm leading-[1.55] text-text-primary/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <p className="mb-1.5 text-[15px] font-semibold text-text-primary">{title}</p>
      {children}
    </div>
  );
}

const SHOWN = 4; // résultats visibles avant « Voir les N… »

export default function SearchAssistant({ onClose, isLoggedIn }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>({ name: "home" });
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const downOnOverlay = useRef(false);

  // À la fermeture, le curseur revient là où il était (bouton de l'en-tête).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  function go(next: View) {
    setView(next);
    setQuery("");
    setActive(0);
    setExpanded(false);
  }
  function open(href: string) {
    onClose();
    router.push(href);
  }

  // ---- Ce qu'il faut chercher, selon la vue ----------------------------------
  const parsed = view.name === "home" ? parseQuery(query) : null;
  const searching = Boolean(parsed && hasSearch(parsed));
  let body: SearchBody | null = null;
  let fallback: SearchBody | null = null;
  if (view.name === "flow") body = flowBody(view.kind, view.answers);
  else if (view.name === "news") {
    body = { type: "projets", sort: "date", since_days: 7 };
    fallback = { type: "projets", sort: "date" }; // semaine vide : les plus récents
  } else if (parsed && searching) body = searchBodyFromQuery(parsed);
  const bodyKey = body ? JSON.stringify(body) : "";
  const fallbackKey = fallback ? JSON.stringify(fallback) : "";
  // La saisie libre attend la fin de la frappe ; un clic de parcours part aussitôt.
  const delay = view.name === "home" ? 300 : 0;

  useEffect(() => {
    if (!bodyKey) return;
    const controller = new AbortController();
    const post = (payload: string) =>
      fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: controller.signal });
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let res = await post(bodyKey);
        let data = await res.json().catch(() => null);
        if (res.ok && fallbackKey && (data?.projects?.length ?? 0) === 0) {
          res = await post(fallbackKey);
          data = await res.json().catch(() => null);
        }
        if (!res.ok) {
          setResults({ talents: [], projects: [] });
          setNotice(data?.error || "Recherche indisponible, réessaie dans un instant.");
        } else {
          setResults({ talents: data?.talents ?? [], projects: data?.projects ?? [] });
          setNotice("");
        }
        setLoading(false);
      } catch {
        if (controller.signal.aborted) return; // remplacée par une recherche plus récente
        setResults({ talents: [], projects: [] });
        setNotice("Connexion impossible, réessaie.");
        setLoading(false);
      }
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bodyKey, fallbackKey, delay]);

  const shown = bodyKey ? results : null;
  const talents = shown?.talents ?? [];
  const films = shown?.projects ?? [];

  // ---- Sections affichées -----------------------------------------------------
  const sections: Section[] = [];

  const talentItems = (list: Talent[]): Item[] =>
    list.map((t) => ({
      id: `t-${t.id}`,
      run: () => open(`/profil/${t.slug}`),
      render: (on) => (
        <span className={`${ROW} min-h-16 ${on ? ROW_ON : ""}`}>
          <Avatar url={t.avatar_url} name={t.full_name} size={42} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{t.full_name}</span>
            <span className="block truncate text-[13px] text-text-secondary">{[t.roles.slice(0, 2).join(", "), t.location].filter(Boolean).join(" · ")}</span>
          </span>
          {t.project_count > 0 && <span className="ml-auto shrink-0 text-xs text-text-secondary">{t.project_count} film{t.project_count > 1 ? "s" : ""}</span>}
        </span>
      ),
    }));
  const filmItems = (list: Film[]): Item[] =>
    list.map((f) => ({
      id: `f-${f.id}`,
      run: () => open(`/projet/${f.slug}`),
      render: (on) => (
        <span className={`${ROW} min-h-16 ${on ? ROW_ON : ""}`}>
          <FilmPoster src={f.preview_url || f.poster_url} alt="" sizes="96px" className="h-10 rounded-md" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{f.title}</span>
            <span className="block truncate text-[13px] text-text-secondary">{[CATEGORY_LABELS[f.category], f.director_name, f.year].filter(Boolean).join(" · ")}</span>
          </span>
        </span>
      ),
    }));
  const more = (count: number, noun: string): Item => ({
    id: `more-${noun}`,
    run: () => setExpanded(true),
    render: row("arrow", `Voir les ${count} ${noun}`),
  });
  const resultSections = (emptyText: string) => {
    if (!bodyKey) return;
    if (!shown) {
      sections.push({ key: "wait", items: [], after: <p className="px-2.5 py-3 text-sm text-text-secondary">Recherche…</p> });
      return;
    }
    if (notice) {
      sections.push({ key: "notice", items: [], after: <p role="alert" className="px-2.5 py-3 text-sm text-[#f97316]">{notice}</p> });
      return;
    }
    if (talents.length > 0) {
      const visible = expanded ? talents : talents.slice(0, SHOWN);
      sections.push({
        key: "talents",
        title: `${talents.length}${talents.length === 50 ? "+" : ""} profil${talents.length > 1 ? "s" : ""}`,
        items: [...talentItems(visible), ...(talents.length > visible.length ? [more(talents.length, "profils")] : [])],
      });
    }
    if (films.length > 0) {
      const visible = expanded ? films : films.slice(0, SHOWN);
      sections.push({
        key: "films",
        title: view.name === "news" ? "Nouveautés" : `${films.length}${films.length === 50 ? "+" : ""} film${films.length > 1 ? "s" : ""}`,
        items: [...filmItems(visible), ...(films.length > visible.length ? [more(films.length, "films")] : [])],
      });
    }
    if (talents.length === 0 && films.length === 0) {
      sections.push({ key: "empty", items: [], after: <p className="px-2.5 py-3 text-sm text-text-secondary">{emptyText}</p> });
    }
  };
  const faqLink = (faq: Faq): Item[] =>
    faq.link
      ? [{ id: `link-${faq.id}`, run: () => open(!isLoggedIn && faq.link!.visitorHref ? faq.link!.visitorHref : faq.link!.href), render: row("arrow", faq.link.label) }]
      : [];
  const faqItems = (except?: FaqId): Item[] =>
    FAQS.filter((f) => f.id !== except).map((f) => ({ id: `faq-${f.id}`, run: () => go({ name: "faq", id: f.id }), render: row("help", f.question) }));

  let crumbs: string[] | null = null;
  let question: string | null = null;

  if (view.name === "home" && !query.trim()) {
    sections.push({
      key: "search",
      title: "Je cherche",
      items: [
        { id: "actor", run: () => go({ name: "flow", kind: "actor", answers: {} }), render: row("person", "Un comédien ou une comédienne", "Par ville, âge de jeu, langue") },
        { id: "tech", run: () => go({ name: "flow", kind: "tech", answers: {} }), render: row("camera", "Un technicien", "Image, son, montage, déco…") },
        { id: "news", run: () => go({ name: "news" }), render: row("star", "Les nouveautés", "Films publiés cette semaine") },
      ],
    });
    sections.push({
      key: "want",
      title: "Je veux",
      items: [
        { id: "publish", run: () => go({ name: "faq", id: "publier" }), render: row("plus", "Publier mon film") },
        { id: "understand", run: () => go({ name: "faq", id: "all" }), render: row("help", "Comprendre comment marche Unkast") },
      ],
    });
  } else if (view.name === "home" && parsed) {
    // Saisie libre : ce qui a été compris, la réponse toute faite, les résultats.
    const understood = [
      parsed.roleLabel,
      parsed.city,
      parsed.language && LANGUAGE_LABELS[parsed.language],
      parsed.category && CATEGORY_LABELS[parsed.category],
      parsed.year,
    ].filter(Boolean) as (string | number)[];
    if (understood.length > 0) crumbs = understood.map(String);
    const faq = parsed.faq ? FAQS.find((f) => f.id === parsed.faq) : undefined;
    if (faq) {
      sections.push({ key: "faq", before: <FaqCard title={faq.question}>{faq.answer}</FaqCard>, items: faqLink(faq) });
    }
    resultSections("Aucun résultat pour cette recherche.");
    if (parsed.rest) {
      const text = query.trim();
      sections.push({ key: "explorer", items: [{ id: "explorer", run: () => open(`/recherche?q=${encodeURIComponent(text)}`), render: row("search", `Chercher « ${text} » dans Explorer`) }] });
    }
  } else if (view.name === "flow") {
    const { kind, answers } = view;
    crumbs = ["Je cherche", ...flowCrumbs(kind, answers)];
    const step = stepsFor(kind, answers).find((s) => !(s.key in answers));
    if (step) {
      question = step.question;
      const typed = normalize(query);
      const options = step.options.filter((o) => !typed || normalize(o.label).includes(typed));
      // Ville hors liste : ce qui est tapé devient la réponse.
      if (step.freeText && query.trim() && !options.some((o) => normalize(o.label) === typed)) {
        options.push({ value: query.trim().slice(0, 60), label: `« ${query.trim().slice(0, 60)} »` });
      }
      const answer = (value: string) => go({ name: "flow", kind, answers: { ...answers, [step.key]: value } });
      sections.push({
        key: `step-${step.key}`,
        chips: true,
        items: [
          ...options.map((o) => ({ id: `o-${step.key}-${o.value}`, chip: true, run: () => answer(o.value), render: chip(o.label) })),
          { id: `o-${step.key}-any`, chip: true, run: () => answer(ANY), render: chip("Peu importe") },
        ],
      });
    } else {
      question = "Voici ce que j'ai trouvé";
    }
    resultSections("Aucun profil avec ces critères pour l'instant. Reviens en arrière et essaie « Peu importe ».");
    if (kind === "actor") {
      const contact = FAQS.find((f) => f.id === "contacter")!;
      sections.push({ key: "contact", items: [], after: <FaqCard title="Comment contacter un comédien ou une comédienne ?">{contact.answer}</FaqCard> });
    }
  } else if (view.name === "news") {
    crumbs = ["Je cherche", "Nouveautés"];
    resultSections("Aucun film en ligne pour l'instant.");
  } else if (view.name === "faq") {
    crumbs = ["Je veux", "Comprendre Unkast"];
    if (view.id === "all") {
      sections.push({
        key: "intro",
        before: (
          <FaqCard title="Comment marche Unkast ?">
            Unkast réunit les professionnels du cinéma et de l&apos;audiovisuel autour de leurs films. Chacun crée son profil, publie ses films
            et crédite son équipe. On découvre un talent en regardant son travail, puis on lui écrit.
          </FaqCard>
        ),
        title: "Questions fréquentes",
        items: faqItems(),
      });
    } else {
      const faq = FAQS.find((f) => f.id === view.id)!;
      sections.push({ key: "answer", before: <FaqCard title={faq.question}>{faq.answer}</FaqCard>, items: faqLink(faq) });
      sections.push({ key: "others", title: "Autres questions", items: faqItems(faq.id) });
    }
  }

  const flat = sections.flatMap((s) => s.items);
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  const activeId = activeIndex >= 0 ? `assistant-${flat[activeIndex].id}` : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function back() {
    if (view.name === "flow") {
      const answered = stepsFor(view.kind, view.answers).filter((s) => s.key in view.answers);
      const last = answered[answered.length - 1];
      if (!last) return go({ name: "home" });
      const answers = { ...view.answers };
      delete answers[last.key];
      if (last.key === "family") delete answers.role;
      return go({ name: "flow", kind: view.kind, answers });
    }
    if (view.name !== "home") go({ name: "home" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const move = (delta: number) => {
      e.preventDefault();
      if (flat.length > 0) setActive((activeIndex + delta + flat.length) % flat.length);
    };
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) move(1);
    else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) move(-1);
    // Gauche / droite : seulement entre les boutons d'une question, champ vide
    // (sinon elles déplacent le curseur dans le texte).
    else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !query && activeIndex >= 0 && flat[activeIndex].chip) move(e.key === "ArrowRight" ? 1 : -1);
    else if (e.key === "Enter") { e.preventDefault(); if (activeIndex >= 0) flat[activeIndex].run(); }
    else if (e.key === "Backspace" && !query && view.name !== "home") { e.preventDefault(); back(); }
  }

  let index = -1;
  const canGoBack = view.name !== "home";

  return createPortal(
    <div
      className="fixed inset-0 z-[9996] bg-black/60 lg:px-4 lg:pt-[9vh]"
      // Fermeture au clic sur le fond seulement si l'appui a aussi commencé sur le fond
      // (une sélection de texte qui déborde ne ferme pas le panneau).
      onMouseDown={(e) => { downOnOverlay.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnOverlay.current) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assistant de recherche"
        onKeyDown={onKeyDown}
        className="glass-strong mx-auto flex h-full w-full flex-col overflow-hidden rounded-none border-0 bg-glass-solid/92 lg:h-auto lg:max-h-[80vh] lg:max-w-[640px] lg:rounded-[28px] lg:border lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_40px_120px_rgba(0,0,0,0.7)]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Champ de saisie */}
        <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-white/[0.08] px-5 text-text-secondary">
          {canGoBack ? (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={back} aria-label="Étape précédente" className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/[0.07]">
              <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
          ) : (
            <Icon name="search" className="size-5 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="assistant-list"
            aria-activedescendant={activeId}
            aria-label="Rechercher"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={100}
            value={query}
            onChange={(e) => {
              const text = e.target.value;
              setQuery(text);
              setActive(0);
              setExpanded(false);
              // Taper depuis une réponse ou les nouveautés revient à la recherche libre.
              if (text && (view.name === "faq" || view.name === "news")) setView({ name: "home" });
            }}
            placeholder={view.name === "flow" ? "Filtrer les réponses" : "Un film, un talent, un métier"}
            className="min-w-0 flex-1 bg-transparent text-lg text-text-primary outline-none placeholder:text-text-secondary"
          />
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg bg-white/[0.07] px-2 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary">
            <span className="max-lg:hidden">Échap</span>
            <span className="lg:hidden">Fermer</span>
          </button>
        </div>

        {/* Fil d'Ariane, question, réponses et résultats */}
        <div id="assistant-list" role="listbox" aria-label="Propositions" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
          {crumbs && (
            <p className="flex flex-wrap items-center gap-2 px-5 pt-3.5 text-[13px] text-text-secondary">
              {crumbs.map((c, i) => (
                <span key={i} className="contents">
                  {i > 0 && <span aria-hidden="true">›</span>}
                  <span className={i > 0 || view.name === "home" ? "font-semibold text-text-primary" : ""}>{c}</span>
                </span>
              ))}
            </p>
          )}
          {question && <p className="px-5 pb-1 pt-3.5 text-xl font-bold tracking-tight text-text-primary">{question}</p>}

          {sections.map((section) => (
            <div key={section.key} className="px-3 pt-3">
              {section.before}
              {section.title && <p className="px-2.5 pb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-secondary">{section.title}</p>}
              <div className={section.chips ? "flex flex-wrap gap-2 px-2 pb-2" : "flex flex-col"}>
                {section.items.map((item) => {
                  index += 1;
                  const i = index;
                  const on = i === activeIndex;
                  return (
                    <button
                      key={item.id}
                      id={`assistant-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={on}
                      tabIndex={-1}
                      // Le curseur reste dans le champ : on peut continuer à taper après un clic.
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => { if (!on) setActive(i); }}
                      onClick={item.run}
                      className="press-spring text-left"
                    >
                      {item.render(on)}
                    </button>
                  );
                })}
              </div>
              {section.after}
            </div>
          ))}
          {loading && shown && <p className="px-5 pt-2 text-xs text-text-tertiary">Mise à jour…</p>}
        </div>

        {/* Rappel des touches (clavier : desktop seulement) */}
        <div className="flex shrink-0 gap-[18px] border-t border-white/[0.08] px-5 py-3 text-xs text-text-secondary max-lg:hidden">
          <span><Kbd>↑↓</Kbd>Naviguer</span>
          <span><Kbd>Entrée</Kbd>Choisir</span>
          {canGoBack && <span><Kbd>Retour</Kbd>Étape précédente</span>}
          <span><Kbd>Échap</Kbd>Fermer</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mr-1.5 rounded-md bg-white/[0.07] px-1.5 py-0.5 font-sans text-[11px] font-semibold text-text-secondary">{children}</kbd>;
}
