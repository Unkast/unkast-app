"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useLayoutEffect, useState, useCallback, useSyncExternalStore, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import Avatar from "@/components/Avatar";
import { getDisplayName } from "@/lib/profile";
import LiquidDock from "@/components/LiquidDock";
import MobileTabBar from "@/components/MobileTabBar";
import Button from "@/components/ui/Button";
import LegalLinks, { TermsCheckbox } from "@/components/LegalLinks";
import { LEGAL_LINKS } from "@/lib/legal";

// Assistant de recherche (lot 8) : charge seulement a sa premiere ouverture.
const SearchAssistant = dynamic(() => import("@/components/SearchAssistant"), { ssr: false });

// Pages ou l'ecran « Les CGU ont ete mises a jour » ne s'affiche pas : les trois
// pages legales (pour pouvoir les lire) et les deux pages de compte bloque.
const TERMS_EXEMPT_PATHS: string[] = [...LEGAL_LINKS.map((l) => l.href), "/suspended", "/compte-introuvable"];

// App installee (Capacitor natif, ou PWA en display-mode standalone) → classe
// `app-installed` sur <html>. Elle choisit en CSS la navigation mobile : LiquidDock si
// installee, MobileTabBar (barre plate) sinon. Dans le doute, rien n'est pose : rendu
// navigateur par defaut.
// Execute deux fois : en script inline dans le HTML serveur (avant le premier rendu,
// donc sans flash), et dans un useLayoutEffect pour le cas ou AppShell est monte cote
// client (arrivee depuis `/`), ou un <script> rendu par React ne s'execute pas.
const INSTALLED_CLASS = "app-installed";

function isInstalledApp() {
  try {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return (
      cap?.isNativePlatform?.() === true ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

const INSTALLED_SCRIPT =`(function(){try{var c=window.Capacitor;if((c&&c.isNativePlatform&&c.isNativePlatform())||window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)document.documentElement.classList.add("${INSTALLED_CLASS}")}catch(e){}})()`;

// Icons
const IconExplore = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconSearch = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IconProfile = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const IconFilm = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 4V2m0 2v2m0-2H5m2 0h2M3 20h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2zM15 12l-4 2.5v-5l4 2.5z" />
  </svg>
);
const IconCredits = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const IconMessages = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const IconDashboard = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const IconJoin = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);
const IconChat = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

interface UserProfile {
  full_name: string;
  slug: string;
  account_type: string;
  avatar_url: string | null;
  role_name?: string;
  is_admin?: boolean;
}

// Pages that don't show a back button
const ROOT_PAGES = ["/feed", "/recherche", "/messages", "/moi"];

// Clavier virtuel ouvert sur un champ de saisie ? Sert a sortir le dock, qui sinon
// remonte au-dessus du clavier (la WebView Android redimensionne la fenetre).
// Le focus d'un champ de texte suffit a le supposer ouvert. visualViewport sert a
// reperer le cas ou l'utilisateur referme le clavier sans quitter le champ : la
// hauteur a retreci puis est revenue a sa valeur de reference.
const NON_TEXT_INPUTS = ["checkbox", "radio", "button", "submit", "reset", "range", "file", "color", "image", "hidden"];

function isTextField(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && !NON_TEXT_INPUTS.includes((el as HTMLInputElement).type);
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    const height = () => vv?.height ?? window.innerHeight;
    let base = height();
    let focused = false;
    let shrunk = false;

    function onFocusIn(e: FocusEvent) {
      if (!isTextField(e.target)) return;
      focused = true;
      shrunk = false;
      setOpen(true);
    }
    function onFocusOut() {
      focused = false;
      setOpen(false);
    }
    function onResize() {
      const h = height();
      if (!focused) {
        base = h;
        return;
      }
      if (base - h > 120) {
        shrunk = true;
        setOpen(true);
      } else if (shrunk) {
        setOpen(false);
      }
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    (vv ?? window).addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      (vv ?? window).removeEventListener("resize", onResize);
    };
  }, []);

  return open;
}

function getPageTitle(pathname: string): string | null {
  if (pathname === "/connexion") return "Connexion";
  if (pathname === "/rejoindre") return "Créer un compte";
  if (pathname.startsWith("/profil/")) return "Profil";
  if (pathname.startsWith("/projet/")) return "Projet";
  if (pathname === "/recherche") return "Recherche";
  return null;
}

export default function AppShell({
  children,
  initialUser = null,
  initialUnread = 0,
  needsTerms = false,
  sessionHint = false,
}: {
  children: React.ReactNode;
  initialUser?: UserProfile | null;
  initialUnread?: number;
  // Vrai si le serveur n'a pas pu resoudre le compte alors qu'un cookie de session
  // existe : la navigation attend le navigateur au lieu d'afficher le mode visiteur.
  sessionHint?: boolean;
  // Vrai si le membre connecte n'a pas accepte la version en vigueur des CGU
  // (calcule cote serveur par (app)/layout.tsx).
  needsTerms?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 });
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  // Apres une connexion, router.refresh() rend le layout avec le compte : l'etat suit.
  const [seenInitialUser, setSeenInitialUser] = useState(initialUser);
  if (initialUser !== seenInitialUser) {
    setSeenInitialUser(initialUser);
    if (initialUser) setUser(initialUser);
  }
  // L'auth est resolue cote serveur (layout RSC). Reste un cas d'attente : une session
  // existe mais le profil n'est pas encore la (connexion en cours, ou serveur qui n'a
  // pas pu lire le compte). On n'affiche alors NI le mode visiteur NI le compte.
  const [authPending, setAuthPending] = useState(sessionHint);
  const authChecked = !!user || !authPending;
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const isAdmin = user?.is_admin === true;

  // Ecran bloquant « Les CGU ont ete mises a jour ». termsDone le ferme tout de
  // suite apres l'acceptation, le temps que router.refresh() remette needsTerms a
  // faux ; il est remis a zero a la deconnexion (un autre compte peut suivre).
  const [termsDone, setTermsDone] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [termsError, setTermsError] = useState("");
  const termsCheckboxRef = useRef<HTMLInputElement>(null);
  const showTerms = needsTerms && !!user && !termsDone && !TERMS_EXEMPT_PATHS.includes(pathname);

  useEffect(() => {
    if (showTerms) termsCheckboxRef.current?.focus();
  }, [showTerms]);

  function resetTerms() {
    setTermsDone(false);
    setTermsChecked(false);
    setTermsError("");
  }

  async function handleAcceptTerms() {
    if (!termsChecked || termsSaving) return;
    setTermsSaving(true);
    setTermsError("");
    try {
      const res = await fetch("/api/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setTermsError(data?.error || "Enregistrement impossible, réessaie.");
        return;
      }
      setTermsDone(true);
      // Le layout serveur recalcule needsTerms (sinon sa valeur resterait en cache).
      router.refresh();
    } catch {
      setTermsError("Connexion impossible, réessaie.");
    } finally {
      setTermsSaving(false);
    }
  }

  const showBack = !ROOT_PAGES.includes(pathname);
  const pageTitle = getPageTitle(pathname);
  // Conversation ouverte : pas de dock, la barre de saisie se cale en bas de l'ecran.
  const inConversation = /^\/messages\/[^/]+/.test(pathname);
  const keyboardOpen = useKeyboardOpen();
  const rootRef = useRef<HTMLDivElement>(null);

  // Vrai au rendu serveur et pendant l'hydratation, faux sur un montage client : le
  // <script> inline n'est rendu que la ou il peut s'executer (React le signale sinon).
  const fromServerHtml = useSyncExternalStore(noopSubscribe, () => false, () => true);

  useLayoutEffect(() => {
    if (isInstalledApp()) document.documentElement.classList.add(INSTALLED_CLASS);
  }, []);

  // Clavier ouvert : la hauteur du shell suit visualViewport, pour que le bas de page
  // (barre de saisie) reste au-dessus du clavier meme la ou il ne redimensionne pas la
  // mise en page (iOS, WebView sans interactive-widget). Ignore pendant un zoom.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = rootRef.current;
    if (!keyboardOpen || !vv || !el) return;
    const sync = () => {
      if (Math.abs(vv.scale - 1) < 0.01) el.style.height = `${vv.height}px`;
    };
    sync();
    vv.addEventListener("resize", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      el.style.height = "";
    };
  }, [keyboardOpen]);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Assistant de recherche : ouvert par le champ de l'en-tete desktop, la loupe de
  // l'en-tete mobile, ou Ctrl K / Cmd K depuis n'importe quelle page.
  const [assistantOpen, setAssistantOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAssistantOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Register push notifications when logged in
  usePushNotifications(!!user);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const res = await fetch("/api/dashboard/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          // /api/dashboard/profile ne renvoie pas is_admin (colonne privilegiee,
          // hors perimetre de cette route). On la preserve depuis l'etat
          // precedent plutot que de la perdre a chaque re-sync post-connexion.
          setUser((prev) => ({
            full_name: getDisplayName(data.profile),
            slug: data.profile.slug,
            account_type: data.profile.account_type || "talent",
            avatar_url: data.profile.avatar_url,
            role_name: data.roles?.[0]?.role_name,
            is_admin: prev?.is_admin,
          }));
        }
      }
    } catch {
      // silently fail
    } finally {
      setAuthPending(false);
    }
  }, []);

  useEffect(() => {
    // L'utilisateur initial vient du serveur (props) → pas de getUser bloquant ici.
    // On écoute seulement les changements d'auth (login/logout/refresh de token).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION est déjà couvert par les props serveur — on l'ignore pour
      // ne pas refaire un fetch profil inutile au montage. Sauf si le serveur n'a
      // pas fourni le compte : c'est alors le navigateur qui tranche.
      if (event === "INITIAL_SESSION" && initialUser) return;
      if (session?.user) {
        // En attente jusqu'au profil : pas de barre « visiteur » sur une session ouverte.
        setAuthPending(true);
        fetchUserProfile(session.user.id);
      } else {
        setAuthPending(false);
        if (event === "INITIAL_SESSION") return;
        setUser(null);
        resetTerms();
      }
    });

    const unreadInterval = setInterval(() => {
      fetch("/api/messages/unread-count").then(r => r.json()).then(d => setUnreadCount(d.count || 0)).catch(() => {});
    }, 30000);

    // Les 4 router.prefetch("/feed" | "/recherche" | "/moi" | "/messages") ont ete
    // retires. Ils faisaient un prefetch COMPLET, mis en cache client 5 minutes
    // (staleTimes.static) : une navigation dans cette fenetre etait servie sans
    // requete reseau, donc sans passer par le proxy (ex-middleware) — ni controle
    // de suspension, ni garde /moi. Ces 4 routes sont deja des <Link> dans la tab
    // bar et la sidebar : elles beneficient du prefetch PARTIEL au viewport, qui
    // donne la meme sensation d'instantaneite tout en laissant la navigation
    // reelle repasser par le proxy. Ne pas les remettre sans relire le matcher de
    // src/proxy.ts.

    return () => {
      subscription.unsubscribe();
      clearInterval(unreadInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserProfile]);

  // Close menus on click outside
  useEffect(() => {
    if (!menuOpen && !mobileMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen, mobileMenuOpen]);

  // Android hardware/gesture back button
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    async function setup() {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", () => {
          const current = window.location.pathname;
          const isRootPage = current === "/feed" || current === "/recherche" || current === "/messages" || current === "/moi";

          if (isRootPage) {
            App.exitApp();
          } else {
            window.history.back();
          }
        });
        cleanup = () => listener.remove();
      } catch {
        // Not running in Capacitor
      }
    }
    setup();
    return () => { cleanup?.(); };
  }, []);

  // Service worker : uniquement en PRODUCTION.
  // En développement, le SW garde des caches périmés (images "empoisonnées" par
  // un 404 mémorisé, bundles JS obsolètes…) -> on le désenregistre activement et
  // on vide ses caches pour repartir propre à chaque session locale.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  }, []);

  // Set status bar style (dark = white icons on dark bg)
  useEffect(() => {
    async function initStatusBar() {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0d0d0d" });
      } catch {
        // Not running in Capacitor
      }
    }
    initStatusBar();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    await fetch("/api/logout", { method: "POST" });
    sessionStorage.removeItem("unkast_has_explored");
    localStorage.removeItem("unkast_splash_time");
    setUser(null);
    resetTerms();
    setMenuOpen(false);
    setMobileMenuOpen(false);
    router.replace("/");
    router.refresh();
  }

  const isCreator = user?.account_type === "creator";

  // Build nav items based on auth state
  const sidebarItems: NavItem[] = user
    ? [
        { href: "/feed", label: "Accueil", icon: <IconExplore /> },
        { href: "/recherche", label: "Recherche", icon: <IconSearch /> },
      ]
    : [
        { href: "/feed", label: "Accueil", icon: <IconExplore /> },
        { href: "/recherche", label: "Recherche", icon: <IconSearch /> },
      ];

  const sidebarUserItems: NavItem[] = user
    ? [
        { href: "/moi", label: "Mon profil", icon: <IconProfile /> },
        { href: "/messages", label: "Messages", icon: <IconMessages /> },
      ]
    : [];

  const mobileItems: NavItem[] = user
    ? [
        { href: "/feed", label: "Accueil", icon: <IconExplore /> },
        { href: "/recherche", label: "Recherche", icon: <IconSearch /> },
        { href: "/messages", label: "Messages", icon: <IconChat />, badge: unreadCount },
        { href: "/moi", label: "Profil", icon: <IconProfile /> },
      ]
    : [
        { href: "/feed", label: "Accueil", icon: <IconExplore /> },
        { href: "/recherche", label: "Recherche", icon: <IconSearch /> },
        { href: "/rejoindre", label: "Rejoindre", icon: <IconJoin /> },
      ];

  const allSidebarItems = [...sidebarItems, ...sidebarUserItems];
  const activeIndex = allSidebarItems.findIndex((item) => {
    if (item.href === "/feed") return pathname === "/feed" || pathname === "/";
    return pathname.startsWith(item.href);
  });

  function isActive(href: string) {
    if (href === "/feed") return pathname === "/feed" || pathname === "/";
    return pathname.startsWith(href);
  }

  // Dock mobile : l'onglet Profil garde l'avatar a la place de l'icone. Sur la bille
  // (onglet actif), sa bordure passe en sombre pour se detacher du citron.
  const dockActiveIndex = mobileItems.findIndex((item) => isActive(item.href));
  const dockItems = mobileItems.map((item, i) =>
    user && item.href === "/moi"
      ? {
          ...item,
          icon: (
            <Avatar
              url={user.avatar_url}
              name={user.full_name}
              size={28}
              style={{ border: i === dockActiveIndex ? "2px solid #0A0A0C" : "1.5px solid rgba(255,255,255,0.15)" }}
            />
          ),
        }
      : item
  );
  // Barre plate (navigateur) : memes onglets, l'avatar actif garde sa bordure citron.
  const tabBarItems = mobileItems.map((item, i) =>
    user && item.href === "/moi"
      ? {
          ...item,
          icon: (
            <Avatar
              url={user.avatar_url}
              name={user.full_name}
              size={24}
              style={{ border: i === dockActiveIndex ? "2px solid #C8FF00" : "1.5px solid rgba(255,255,255,0.15)" }}
            />
          ),
        }
      : item
  );
  const navHidden = inConversation || keyboardOpen;

  // Animate sidebar indicator
  useEffect(() => {
    if (!navRef.current || activeIndex < 0) return;
    const links = navRef.current.querySelectorAll("a");
    const el = links[activeIndex];
    if (el) {
      setIndicatorStyle({ top: el.offsetTop, height: el.offsetHeight });
    }
  }, [activeIndex, user]);

  return (
    <>
    {/* Hauteur = zone reellement visible (100dvh, repli 100vh) : avec 100vh seul, le bas du
        shell passait sous la barre d'adresse de Chrome Android.
        inert : sous l'ecran des CGU, rien n'est cliquable ni atteignable au clavier. */}
    <div ref={rootRef} inert={showTerms} className="flex h-screen supports-[height:100dvh]:h-dvh overflow-hidden">
      {fromServerHtml && <script dangerouslySetInnerHTML={{ __html: INSTALLED_SCRIPT }} />}
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 m-[14px] rounded-[30px] glass-strong">
        <div className="h-14 flex items-center px-5 border-b border-white/5">
          <Link href="/feed" className="text-lg font-extrabold tracking-tight text-text-primary">
            Unkast<span className="text-lime">.</span>
          </Link>
        </div>

        <nav ref={navRef} className="relative flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          {/* Sliding highlight */}
          <AnimatePresence>
            {activeIndex >= 0 && (
              <motion.div
                layoutId="sidebar-indicator"
                className="absolute left-2.5 right-2.5 rounded-xl glass backdrop-filter-none"
                style={{ top: indicatorStyle.top, height: indicatorStyle.height }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              >
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime shadow-[0_0_10px_rgba(200,255,0,0.8)]" />
              </motion.div>
            )}
          </AnimatePresence>

          {sidebarItems.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}

          {user && (
            <>
              <div className="h-px bg-white/5 my-2" />
              {sidebarUserItems.map((item) => (
                <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </>
          )}
        </nav>

        {/* Bottom: user zone or CTA */}
        {user ? (
          <div className="relative p-2.5 border-t border-white/5" ref={menuRef}>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-2.5 right-2.5 mb-1.5 bg-[#1a1a1a] border border-white/[0.08] rounded-lg p-1.5 shadow-xl z-50"
                >
                  <MenuLink href="/moi" onClick={() => setMenuOpen(false)}>Mon profil</MenuLink>
                  {isAdmin && (
                    <MenuLink href="/admin" onClick={() => setMenuOpen(false)}>Administration</MenuLink>
                  )}
                  <div className="h-px bg-white/5 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 rounded-md text-[13px] text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition"
                  >
                    Se déconnecter
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition"
            >
              <Avatar url={user.avatar_url} name={user.full_name} size={32} />
              <div className="min-w-0 text-left">
                <p className="text-[12px] font-semibold text-text-primary truncate">{user.full_name}</p>
                {user.role_name && (
                  <p className="text-[10px] text-text-tertiary truncate">{user.role_name}</p>
                )}
              </div>
              <svg className={`w-3.5 h-3.5 text-text-tertiary ml-auto transition-transform ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        ) : !authChecked ? null : (
          <div className="p-3 border-t border-white/5 space-y-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/rejoindre"
                className="block w-full py-2.5 text-center bg-lime text-[#0d0d0d] font-bold text-xs rounded-lg transition"
              >
                Rejoindre Unkast
              </Link>
            </motion.div>
            <Link
              href="/connexion"
              className="block w-full py-1.5 text-center text-[11px] text-text-tertiary hover:text-text-primary transition"
            >
              Déjà inscrit ? Se connecter
            </Link>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Masque en mobile dans une conversation : elle a son propre header (retour, avatar, nom). */}
        {/* Desktop (.app-header, globals.css) : barre transparente posee par-dessus le contenu,
            sans fond ni bordure ; seul le champ de recherche flotte. Le contenu qui defile
            dessous est floute, flou qui s'efface en degrade vers le bas. Mobile : inchange. */}
        <header className={`app-header sticky top-0 z-[9991] flex items-center justify-between px-5 glass-strong rounded-none border-x-0 border-t-0 flex-shrink-0 ${inConversation ? "max-lg:hidden" : ""}`} style={{ paddingTop: "env(safe-area-inset-top, 16px)", minHeight: "calc(56px + env(safe-area-inset-top, 16px))" }}>
          {/* Mobile: back button or logo */}
          <div className="lg:hidden flex items-center gap-2">
            {showBack ? (
              <>
                <button
                  onClick={() => router.back()}
                  className="w-11 h-11 -ml-3 flex items-center justify-center rounded-full text-[#f0f0f0] active:bg-white/5"
                  aria-label="Retour"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {/* /rejoindre : pas de titre, il ne tient pas a 360 px a cote des deux boutons. */}
                {pageTitle && !pathname.startsWith("/rejoindre") && (
                  <span className="text-sm font-medium text-text-primary">{pageTitle}</span>
                )}
              </>
            ) : (
              <Link href="/feed" className="text-[24px] font-bold text-[#f0f0f0]" style={{ letterSpacing: "-0.8px" }}>
                Unkast<span className="text-[#C8FF00]">.</span>
              </Link>
            )}
          </div>
          {/* Desktop : champ de recherche centre. C'est un bouton : il ouvre l'assistant de
              recherche (Ctrl K). Absent sur /recherche, qui a son propre champ. */}
          {pathname === "/recherche" ? (
            <span className="hidden lg:block" />
          ) : (
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              aria-label="Rechercher"
              aria-haspopup="dialog"
              className="glass mx-auto hidden min-h-11 flex-[0_1_460px] items-center gap-2.5 rounded-pill pl-4 pr-2 text-left text-sm text-text-secondary transition-colors duration-fast hover:border-white/20 lg:flex"
            >
              <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.5-4.5M18 11a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="min-w-0 flex-1 truncate">Un film, un talent, un métier</span>
              <kbd className="rounded-lg bg-white/[0.07] px-2 py-1 font-sans text-[11px] font-semibold text-text-secondary">Ctrl K</kbd>
            </button>
          )}
          <div className="flex items-center gap-3">
            {/* Mobile : loupe, ouvre l'assistant en plein ecran. Pour un visiteur, masquee sous
                400 px : elle ne tient pas a cote de « Se connecter » et « Rejoindre » (l'onglet
                Recherche reste la). */}
            {pathname !== "/recherche" && (
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                aria-label="Rechercher"
                aria-haspopup="dialog"
                className={`-mr-1 flex size-11 items-center justify-center rounded-full text-text-primary active:bg-white/5 lg:hidden ${authChecked && !user ? "max-[399px]:hidden" : ""}`}
              >
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.5-4.5M18 11a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
            {authChecked && !user && (
              <div className="flex items-center gap-2 lg:hidden">
                <Link
                  href="/connexion"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#f0f0f0",
                    fontSize: 13,
                    fontWeight: 400,
                    borderRadius: 20,
                    padding: "7px 14px",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  Se connecter
                </Link>
                <Link
                  href="/rejoindre"
                  style={{
                    background: "#C8FF00",
                    border: "none",
                    color: "#0d0d0d",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 20,
                    padding: "7px 16px",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Rejoindre
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* .pb-tabbar (globals.css) reserve ici, pour toutes les pages, la hauteur de la
            navigation mobile : 56 px pour la barre plate du navigateur, 92 px pour le dock
            de l'app installee (marge 10 + barre 56 + collerette 22 = 88 px, + 4 px d'air).
            Dans une conversation, la navigation est masquee et la page occupe toute la
            hauteur sans defiler elle-meme (seule la liste des messages defile). */}
        {/* lg:pt-14 : en desktop l'en-tete (56 px) est pose par-dessus, le contenu commence dessous. */}
        <main className={`flex-1 overflow-y-auto lg:pt-14 ${inConversation ? "max-lg:overflow-hidden" : "pb-tabbar"}`}>
          {children}
        </main>
      </div>

      {/* Navigation mobile (hidden until auth checked) : les deux rendus sont dans le DOM,
          le CSS n'en affiche qu'un selon la classe app-installed. */}
      {authChecked && (
        <>
          <MobileTabBar items={tabBarItems} activeIndex={dockActiveIndex} hidden={navHidden} />
          <LiquidDock items={dockItems} activeIndex={dockActiveIndex} hidden={navHidden} />
        </>
      )}
    </div>

    {assistantOpen && <SearchAssistant onClose={() => setAssistantOpen(false)} isLoggedIn={!!user} />}

    {/* Ecran bloquant : aucune fermeture au clic sur le fond ni avec Echap. Seules
        issues : accepter ou se deconnecter. Au-dessus de tout (Toast = 10000). */}
    {showTerms && (
      <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[20px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-update-title"
          aria-describedby="terms-update-text"
          className="glass-strong bg-glass-solid/80 max-h-full w-full max-w-md overflow-y-auto rounded-panel p-5 sm:p-6"
        >
          <h2 id="terms-update-title" className="text-xl font-bold tracking-tight text-text-primary">
            Avant de continuer
          </h2>
          <p id="terms-update-text" className="mt-2 text-sm leading-relaxed text-text-secondary">
            Pour utiliser Unkast, lis et accepte les conditions d&apos;utilisation et la politique de confidentialité.
          </p>

          <LegalLinks newTab className="mt-2" />

          <TermsCheckbox
            checked={termsChecked}
            onChange={setTermsChecked}
            inputRef={termsCheckboxRef}
            className="mt-3"
          />

          {termsError && (
            <p role="alert" className="mt-3 text-sm text-red-400">{termsError}</p>
          )}

          <Button
            size="lg"
            fullWidth
            onClick={handleAcceptTerms}
            disabled={!termsChecked || termsSaving}
            className="mt-4 disabled:cursor-not-allowed"
          >
            {termsSaving ? "Enregistrement..." : "Continuer"}
          </Button>

          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-11 px-3 text-[13px] text-text-secondary underline underline-offset-2 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
            >
              Me déconnecter
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ---- Sub-components ---- */

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-2.5 min-h-11 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime ${
        active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <span className={`transition-colors duration-200 ${active ? "text-lime" : "text-text-tertiary"}`}>
        {item.icon}
      </span>
      {item.label}
      {(item.badge ?? 0) > 0 && (
        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-lime/15 text-lime text-[10px] font-bold">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center px-3 py-2 rounded-md text-[13px] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary transition"
    >
      {children}
    </Link>
  );
}
