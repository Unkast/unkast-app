# Unkast — Architecture

## Stack technique

- **Framework** : Next.js 16.2.0 (App Router) + React 19 + TypeScript 5
- **Backend / BDD / Auth** : Supabase (PostgreSQL + Auth + RLS)
- **Hosting** : Vercel
- **Styling** : Tailwind CSS 4
- **Animations** : framer-motion 12
- **Video** : react-player 3 (embeds Vimeo/YouTube)
- **Email** : resend 6 (dependance installee, pas encore connectee)

## Legende

```
CORE     = Infrastructure de base (layout, auth, navigation)
FEATURE  = Fonctionnalite metier (page principale)
SUB      = Sous-fonctionnalite d'une FEATURE
HOOK     = Hook React custom
UTILITY  = Helper / utilitaire
STORE    = Store de state management
PLUGIN   = Plugin natif

RELATIONS :
  [utilise]       = Importe et utilise directement
  [declenche]     = Provoque une action dans
  [depend de]     = Ne fonctionne pas sans
  [persiste dans] = Ecrit/lit dans cette table/store
```

## Arbre fonctionnel

```
CORE  Layout (src/app/layout.tsx)
  [utilise] AppShell (src/components/AppShell.tsx)
  [utilise] SplashScreen (src/components/SplashScreen.tsx)
  [utilise] globals.css (src/app/globals.css)

CORE  AppShell (src/components/AppShell.tsx)
  Navigation desktop : sidebar fixe w-56 avec indicateur anime (framer-motion layoutId)
  Navigation mobile : bottom tab bar fixe avec indicateur
  Header : logo mobile + section name desktop + icone recherche
  [utilise] framer-motion (motion, AnimatePresence)
  [depend de] next/navigation (usePathname)

CORE  SplashScreen (src/components/SplashScreen.tsx)
  Video splash /public/splash.mp4, une fois par session (sessionStorage)
  CSS-driven fade-out, fallback auto-dismiss 5.5s
  Bouton "Passer" pour skip

CORE  Middleware (src/middleware.ts)
  Rafraichit le token de session Supabase sur chaque requete
  Ne bloque PAS les utilisateurs non authentifies
  [utilise] src/lib/supabase/middleware.ts

CORE  Supabase Server Client (src/lib/supabase/server.ts)
  Factory async pour client Supabase cote serveur (cookies via next/headers)
  Utilise par tous les Server Components et API Routes

CORE  Supabase Browser Client (src/lib/supabase/client.ts)
  Factory pour client Supabase cote navigateur
  NON UTILISE actuellement (tout passe par les API Routes)

CORE  Constants (src/lib/constants.ts)
  CATEGORY_COLORS, CATEGORY_LABELS, MAX_PROJECTS_FREE (= 3)

CORE  Types (src/types/database.ts)
  Types TypeScript : Profile, ProfileRole, Project, ProjectCredit, ContactRequest
  Schema Supabase type : Database
  Enums : ProfileStatus, ProjectCategory, ContactSubject, ContactStatus

CORE  Motion Primitives (src/components/motion.tsx)
  Variants : staggerContainer, fadeUp, fadeIn, scaleIn
  Preset : cardHover (whileHover scale 1.02)
  Composants : FadeInView (IntersectionObserver), ModalBackdrop (overlay + scale-in)

---

FEATURE  Feed — /feed (src/app/(app)/feed/page.tsx) [Server Component]
  Hero : carousel 3D fan-style (5 projets) avec auto-avance et swipe
  Rangees horizontales scrollables par categorie
  Section "Talents a decouvrir"
  [utilise] HeroCarousel (src/app/(app)/feed/HeroCarousel.tsx)
  [utilise] HomeAnimations (src/app/(app)/feed/HomeAnimations.tsx) — Section, AnimatedCard
  [utilise] Supabase Server Client
  [utilise] Constants (CATEGORY_LABELS, CATEGORY_COLORS)
  [persiste dans] profiles, projects, profile_roles, project_credits (lecture)

  SUB  HeroCarousel (src/app/(app)/feed/HeroCarousel.tsx) [Client Component]
    Carousel fan 3D — 5 cartes en eventail (framer-motion)
    Auto-avance 4s, swipe tactile, dots de navigation
    Info animee (titre, categorie, annee, boutons)
    [utilise] framer-motion (motion, AnimatePresence)
    [utilise] Constants (CATEGORY_LABELS)

  SUB  HomeAnimations (src/app/(app)/feed/HomeAnimations.tsx) [Client Component]
    Section : wrapper FadeInView pour sections scroll-reveal
    AnimatedCard : hover scale + tap feedback

  SUB  ConversionBanner (src/app/(app)/feed/ConversionBanner.tsx) [Client Component]
    Banniere flottante de conversion pour visiteurs non authentifies
    Apparait apres 300px de scroll, disparait si session dismissed ou si connecte
    [utilise] framer-motion (motion, AnimatePresence)
    [utilise] @supabase/ssr (createBrowserClient, getUser)
    [depend de] sessionStorage (cle : unkast_banner_dismissed)

---

FEATURE  Profil public — /profil/[slug] (src/app/profil/[slug]/page.tsx) [Server Component]
  Fetch profil complet (approved uniquement) + roles + projets + credits enrichis
  Metadata OpenGraph dynamique
  [utilise] ProfileClient (src/app/profil/[slug]/ProfileClient.tsx)
  [utilise] Supabase Server Client
  [persiste dans] profiles, profile_roles, projects, project_credits (lecture)

  SUB  ProfileClient (src/app/profil/[slug]/ProfileClient.tsx) [Client Component]
    Avatar, nom, badge disponible, roles pills, localisation, bio
    Bouton contact (ouvre modale) + partage profil
    Liste projets filtrable par categorie avec video embed
    Credits croises depliables, cliquables
    [utilise] VideoEmbed, ContactModal, motion (FadeInView, cardHover)

---

FEATURE  Page projet — /projet/[slug] (src/app/projet/[slug]/page.tsx) [Server Component]
  Fetch projet complet + owner + credits enrichis + projets lies (par collaborateurs communs)
  Metadata OpenGraph dynamique
  [utilise] ProjetClient (src/app/projet/[slug]/ProjetClient.tsx)
  [utilise] Supabase Server Client
  [persiste dans] profiles, profile_roles, projects, project_credits (lecture)

  SUB  ProjetClient (src/app/projet/[slug]/ProjetClient.tsx) [Client Component]
    Video embed plein ecran, titre + categorie + annee
    Onglets Equipe / Projets lies
    Sidebar desktop : fiche technique + carte createur
    [utilise] VideoEmbed, motion (FadeInView)

---

FEATURE  Recherche — /recherche (src/app/recherche/page.tsx)
  [utilise] RechercheClient (src/app/recherche/RechercheClient.tsx)

  SUB  RechercheClient [Client Component]
    Recherche debounced, onglets Tout/Talents/Projets
    Filtres : role, categorie, localisation
    Toggle grille/liste, tri par pertinence/date/projets
    [declenche] GET /api/search
    [utilise] Constants (CATEGORY_LABELS, CATEGORY_COLORS)

---

FEATURE  Inscription — /rejoindre (src/app/rejoindre/page.tsx)
  [utilise] RejoindreClient (src/app/rejoindre/RejoindreClient.tsx)

  SUB  RejoindreClient [Client Component]
    Wizard 4 etapes : compte, profil pro, premier projet, confirmation
    Progress bar animee
    [declenche] POST /api/signup
    [utilise] Constants (CATEGORY_LABELS)

---

FEATURE  Dashboard — /dashboard, /dashboard/projets, /dashboard/contacts
  3 routes thin-shell qui rendent DashboardClient avec initialSection differente

  SUB  DashboardClient (src/app/dashboard/DashboardClient.tsx) [Client Component]
    Sections : profil (view/edit), projets (CRUD, max 3), contacts (accept/decline)
    Redirect vers /rejoindre si 401
    [declenche] GET/PATCH /api/dashboard/profile
    [declenche] GET/POST/DELETE /api/dashboard/projects
    [declenche] GET/PATCH /api/dashboard/contacts
    [utilise] Constants (CATEGORY_LABELS, CATEGORY_COLORS, MAX_PROJECTS_FREE)

---

UTILITY  VideoEmbed (src/components/VideoEmbed.tsx) [Client Component]
  Wrapper SSR-safe de react-player pour Vimeo/YouTube
  Placeholder div pre-hydratation, aspect ratio 16/9
  [utilise] react-player

UTILITY  ContactModal (src/components/ContactModal.tsx) [Client Component]
  Modale de contact : nom, email, sujet, message
  Lock body scroll, animation scale-in
  [declenche] POST /api/contact
  [utilise] motion (ModalBackdrop)

ORPHELIN  Navbar (src/components/Navbar.tsx)
  Composant legacy, N'EST IMPORTE NULLE PART — remplace par AppShell
```

## Notes importantes

1. **Pas de hooks custom** — aucun repertoire `src/hooks/`
2. **Pas de state management global** — tout est en `useState` local
3. **`slugify()` dupliquee** — presente dans `api/signup/route.ts` ET `api/dashboard/projects/route.ts`, pas de utils partage
4. **Resend non connecte** — dependance installee mais aucun email n'est envoye
5. **Pas d'admin API** — l'approbation des profils (pending → approved) se fait via le Supabase Dashboard
6. **Pas d'edit projet** — un projet cree ne peut pas etre modifie, seulement supprime
