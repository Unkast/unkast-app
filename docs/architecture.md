# Unkast — Architecture

> Mis a jour 2026-06-13 (audit doc vs code). Le code a depasse le MVP : ajout de l'admin,
> la messagerie, les credits, les invitations, les comptes Pro/recruteur, la suspension,
> les notifications push. Toutes les routes ci-dessous sont sous le groupe `src/app/(app)/`.

## Stack technique

- **Framework** : Next.js 16.2.0 (App Router) + React 19 + TypeScript 5
- **Backend / BDD / Auth** : Supabase (PostgreSQL + Auth + RLS)
- **Hosting** : Vercel
- **Styling** : Tailwind CSS 4
- **Animations** : framer-motion 12
- **Video** : react-player 3 (embeds Vimeo/YouTube)
- **Mobile natif** : Capacitor (Android) — notifications push via `@capacitor/push-notifications` + FCM
- **Email** : resend 6 (dependance installee, **toujours pas connectee**)

## Legende

```
CORE     = Infrastructure de base (layout, auth, navigation)
FEATURE  = Fonctionnalite metier (page principale)
SUB      = Sous-fonctionnalite d'une FEATURE
HOOK     = Hook React custom
UTILITY  = Helper / utilitaire

RELATIONS :
  [utilise]       = Importe et utilise directement
  [declenche]     = Provoque une action dans
  [depend de]     = Ne fonctionne pas sans
  [persiste dans] = Ecrit/lit dans cette table
```

## Coeur (CORE)

```
CORE  Layout racine (src/app/layout.tsx)
  HTML wrapper, metadata, fonts, PWA manifest. NE contient PAS AppShell.
  Viewport : interactive-widget=resizes-content (le clavier virtuel redimensionne la mise en page).

CORE  Layout app (src/app/(app)/layout.tsx)
  [utilise] AppShell (enveloppe toutes les pages du groupe (app))

CORE  AppShell (src/components/AppShell.tsx)
  Sidebar desktop + navigation mobile + header. Indicateur anime (framer-motion layoutId).
  [utilise] framer-motion, LiquidDock, MobileTabBar ; [depend de] next/navigation (usePathname)
  Deux rendus de navigation mobile (07/10/2026), choisis en CSS par la classe app-installed
  sur <html> : LiquidDock si l'app est installee (Capacitor natif ou PWA standalone),
  MobileTabBar (barre plate) dans un navigateur — rendu par defaut. La classe est posee par un
  script inline rendu dans le HTML serveur (avant le premier rendu, sans flash) et par un
  useLayoutEffect (montage client depuis /). Les deux nav sont dans le DOM, une seule affichee.
  Hauteur du shell : 100dvh (repli 100vh) ; clavier ouvert, elle suit visualViewport.
  Conversation (/messages/[id]) en mobile : header d'AppShell masque, navigation masquee,
  <main> sans defilement — la page occupe toute la zone visible.
  Refonte verre liquide (07/10/2026) : sidebar flottante .glass-strong (marges 14 px, rayon 30),
  indicateur = pastille verre + trait citron, header .glass-strong (dans le flux, PAS en
  surimpression : ProfileClient et ProjetClient ont des colonnes lg:sticky qui passeraient dessous).
  <main> a un pb-9 (36 px) en mobile, app installee seulement : ecart entre le dock (88 px) et
  les 56 px que reservent les pages (.pb-tabbar). La barre plate fait 56 px : aucun pb ajoute.
  Navigation masquee (prop hidden) dans une conversation ouverte et quand le clavier virtuel est
  ouvert : useKeyboardOpen(), hook local a AppShell (focus d'un champ de texte + visualViewport).

CORE  MobileTabBar (src/components/MobileTabBar.tsx) — barre d'onglets mobile du NAVIGATEUR
  Plate, .glass-strong, collee en bas, 56 px + safe area. Onglet actif = icone + libelle citron.
  Memes props que LiquidDock (items, activeIndex, hidden). Masquee si html.app-installed.

CORE  LiquidDock (src/components/LiquidDock.tsx) — dock mobile de l'APP INSTALLEE (html.app-installed)
  Barre flottante 56 px (marges 12, bas = safe-area-inset-bottom + 10), bille citron 44 px qui
  depasse de 14 px sur l'onglet actif, collerette 60 px fusionnee a la barre par un filtre SVG
  goo (#dock-goo). Hauteur totale depuis le bas : 88 px + safe area.
  Fond OPAQUE obligatoire (#121217), lisere produit par le filtre. Deplacement en CSS
  (600 ms ease-dock, collerette +140 ms), coupe par la regle reduced motion de globals.css.
  L'icone ne passe en sombre qu'a l'arrivee de la bille (transition de couleur retardee de 420 ms).
  Props : items (href, label, icon, badge), activeIndex (-1 = aucun onglet actif, pas de bille),
  hidden (sort par le bas en 250 ms, fondu seul en reduced motion, nav inerte).
  [depend de] globals.css (--accent-gradient, --accent-halo, duration-slower, ease-dock)

CORE  SplashScreen (src/components/SplashScreen.tsx)
  Video /public/splash.mp4, une fois par session (sessionStorage).

CORE  Proxy (src/proxy.ts, ex-middleware.ts — renomme 2026-08-10 via le codemod officiel
  `npx @next/codemod middleware-to-proxy`, Next 16 deprecie la convention "middleware")
  Rafraichit la session Supabase + applique les redirections de garde.
  [utilise] src/lib/supabase/middleware.ts (nom de fichier inchange, ce n'est pas
  le fichier de convention — seule la fonction exportee `updateSession` compte)
  Logique : lit profiles.is_admin (fail-closed, service role) et profiles.is_suspended
  (ex. redirige vers /suspended). Lecture de is_suspended (client utilisateur, RLS) :
  transitoire (reseau/5xx/pool) → FAIL-OPEN + log ; PGRST116 (profil Auth orphelin,
  permanent) → FAIL-CLOSED, redirige vers /compte-introuvable (pas /suspended, qui
  mentirait sur la cause).

CORE  Supabase Server Client (src/lib/supabase/server.ts)   — SSR/API (cookies)
CORE  Supabase Browser Client (src/lib/supabase/client.ts)  — navigateur
CORE  Supabase Admin Client (src/lib/supabase/admin.ts)     — service role (bypass RLS, usage admin)

CORE  Constants (src/lib/constants.ts)
  CATEGORY_COLORS, CATEGORY_LABELS, MAX_PROJECTS_FREE (= 3), MAX_PROJECTS_PRO (= 30),
  ACCOUNT_TYPES, ROLES_BY_CATEGORY, ALL_ROLES, ROLE_CATEGORIES, POPULAR_ROLES

CORE  Types (src/types/database.ts) — SOURCE DE VERITE du schema (introspecte 13/06/2026)
  15 interfaces de tables : Profile (35 col.), ProfileRole, Project (12 col.), ProjectCredit,
    ContactRequest, Conversation, Message, CreditRequest, Invitation, ProjectInvitation,
    AdminLog, PushToken, RateLimit, Report, Waitlist
  4 vrais enums Postgres : ProfileStatus, ProjectCategory, ContactSubject, ContactStatus
  Contraints par CHECK : AccountType (talent/creator/recruiter), Plan (free/pro)
  Pseudo-enums (colonnes TEXT libres, NON contraintes en base) : RecruiterStatus,
    DisplayNamePreference, VisibilityAudience, ProjectStatus, CreditRequestStatus,
    InvitationStatus, ReportStatus, WaitlistStatus
  NB : pas de type `Database` (clients Supabase non generiques). Voir docs/database.md.
  ⚠️ supabase/schema.sql est en retard (5 tables) — a regenerer.

CORE  Motion Primitives (src/components/motion.tsx)
  Variants staggerContainer/fadeUp/fadeIn/scaleIn, cardHover, FadeInView, ModalBackdrop
  Verre liquide (07/10/2026) : cardSpring (260/28), listStagger (80 ms), enterUp (18 px + flou
  8 px, 450 ms), enterFade (variante reduced motion), EnterList / EnterItem (useReducedMotion)

UTILITY  lib/utils.ts        — slugify() PARTAGE (utilise par signup, dashboard/projects, auth/callback)
UTILITY  lib/rate-limit.ts   — checkRateLimit() (RPC check_rate_limit, FAIL-CLOSED ; RPC absente toleree hors prod)
UTILITY  lib/messaging.ts    — quota conversations/jour PARTAGE (DAILY_CONVERSATION_LIMIT, countConversationsInitiatedToday)
UTILITY  lib/api.ts          — readJsonBody()/invalidBodyResponse() : body JSON defensif, 400 uniforme (toutes les routes a body)
UTILITY  lib/push.ts         — envoi de notifications push (lit push_tokens)
UTILITY  lib/firebase-admin.ts — init FCM cote serveur
UTILITY  lib/profile.ts      — helpers profil

HOOK  useUserStatus (src/hooks/useUserStatus.ts)        — "anonymous" | "free" | "pro"
HOOK  usePushNotifications (src/hooks/usePushNotifications.ts) — enregistrement push natif (Capacitor)
```

## Fonctionnalites (FEATURE)

```
FEATURE  Welcome / racine — / (src/app/page.tsx + WelcomeClient.tsx)

FEATURE  Feed — /feed (src/app/(app)/feed/page.tsx) [Server Component]
  Hero carousel 3D + rangees par categorie + talents a decouvrir.
  [utilise] HeroCarousel, HeroPlayer, HomeAnimations, ConversionBanner
  [persiste dans] profiles, projects, profile_roles, project_credits (lecture)

FEATURE  Profil public — /profil/[slug] (src/app/(app)/profil/[slug]/) [Server + ProfileClient]
  Fetch profil approuve + roles + projets + credits. Bouton contact + partage.
  [utilise] ProfileClient, VideoEmbed, ContactModal, ReportModal

FEATURE  Page projet — /projet/[slug] (src/app/(app)/projet/[slug]/) [Server + ProjetClient]
  Video plein ecran, equipe, projets lies. [utilise] VideoEmbed

FEATURE  Recherche — /recherche (src/app/(app)/recherche/) [+ RechercheClient]
  Recherche debounced, filtres role/categorie/localisation. [declenche] GET /api/search

FEATURE  Categories — /categories/[slug] (src/app/(app)/categories/[slug]/)
  Listing par categorie.

FEATURE  Inscription — /rejoindre (src/app/(app)/rejoindre/ + RejoindreClient)
  Wizard multi-etapes. [declenche] POST /api/signup

FEATURE  Connexion — /connexion (src/app/(app)/connexion/ + ConnexionClient)
  Login. Callback OAuth/magic-link : src/app/(app)/auth/callback/route.ts

FEATURE  Dashboard — /dashboard, /dashboard/projets, /dashboard/contacts (+ DashboardClient)
  Profil (view/edit), projets (CRUD, max 3 gratuit / 30 en Pro), contacts, credits.
  [declenche] /api/dashboard/{profile,projects,contacts,credits}, /api/avatar

FEATURE  Mon compte — /moi (src/app/(app)/moi/ + MoiClient)

FEATURE  Messagerie — /messages, /messages/[id] (src/app/(app)/messages/)
  Conversations + messages. Quotas (5 conv/j, anti-coordonnees, relance 48h).
  [declenche] /api/messages*  [persiste dans] conversations, messages

FEATURE  Pro / Freemium — /pro (src/app/(app)/pro/)
  Page offre Pro. Deux sources cumulables (chantier grants, 10/08/2026) : abonnement Stripe
  (api/billing/checkout+webhook+portal) et Pro OFFERT par l'admin (grant, voir CRON ci-dessous).
  Bandeau "Pro offert" si grant valide ; boutons d'achat visibles si NEXT_PUBLIC_BILLING_ENABLED
  ou is_admin ; "Gerer mon abonnement" visible seulement si has_stripe_customer (pas juste isPro).
  Detail complet : docs/database.md section "Modele Pro".
  [utilise] useUserStatus, /api/me (plan, pro_grant_type, pro_grant_expires_at, has_stripe_customer)

CORE  Cron expiration Pro — /api/cron/pro-expiry (src/app/api/cron/pro-expiry/)
  Vercel Cron quotidien (vercel.json, 0 6 * * *), secouru par CRON_SECRET (header Authorization).
  Recompute les grants 'launch' echus (RPC recompute_plan) + envoie le rappel J-7 avant echeance
  (lib/email.ts -> sendProExpiryReminderEmail). Jamais de balayage global sur profiles (index
  partiel profiles_pro_grant_expiry_idx).
  [persiste dans] profiles (plan via recompute_plan, pro_grant_reminder_sent_at)

FEATURE  Suspendu — /suspended (src/app/(app)/suspended/)
  Ecran pour comptes is_suspended (lit suspended_reason).

FEATURE  Compte introuvable — /compte-introuvable (src/app/(app)/compte-introuvable/,
  ajoutee 2026-08-10) — cible du fail-closed PGRST116 du proxy (src/lib/supabase/middleware.ts)
  sur un utilisateur Auth sans ligne `profiles` (orphelin, meme diagnostic que
  lib/auth-guard.ts). Pas de fetch dynamique (aucune ligne a lire). Contact
  pro@unkast.com (seule adresse avec un usage reel constate dans le code, mailto:
  a 4 endroits — contact@unkast.com de /suspended n'a aucune trace de configuration,
  pas de var d'env, pas de binding Resend, et n'est meme pas un lien cliquable).
  Mentionne que Google se repare seul (auth/callback recree le profil au relogin).

FEATURE  Admin — /admin (src/app/admin/ + AdminClient) — HORS groupe (app) depuis le 07/08/2026
  Espace structurellement separe de la vue client : pas d'AppShell, layout propre
  (src/app/admin/layout.tsx) avec garde serveur getAdminId() (lib/adminGuard.ts,
  helper partage avec /api/admin) + lien « Retour a l'app ». Entree cote client :
  lien « Administration » dans le menu utilisateur desktop d'AppShell (visible si
  is_admin via fetch /api/me).
  Back-office : recruteurs, reports, users, films. [declenche] GET/PATCH /api/admin
  Onglets : approbation/revocation recruteur (approve_recruiter, revoke_recruiter_approval),
  moderation reports, suspension + Pro offert (grant_pro/revoke_pro_grant, badge d'origine
  Stripe/offert/recruteur), approbation films. Voir docs/database.md "Modele Pro".
```

## Composants transverses (UTILITY / partages)

```
UTILITY  VideoEmbed (src/components/VideoEmbed.tsx)  — wrapper SSR-safe react-player
         + VideoFacade.tsx (facade clic-pour-charger)
UTILITY  ContactModal (src/components/ContactModal.tsx)   [declenche] POST /api/contact
UTILITY  ReportModal (src/components/ReportModal.tsx)     [declenche] POST /api/reports
UTILITY  AvatarUpload (src/components/AvatarUpload.tsx)   [declenche] /api/avatar
UTILITY  RoleSelector (src/components/RoleSelector.tsx) + icons/RoleIcons.tsx
UTILITY  skeletons/ (Feed, Profile, Project, Search)
UTILITY  ui/ (src/components/ui/) — briques du style verre liquide (refonte visuelle, 07/10/2026) :
         Button, Chip, Badge, GlassCard, Field, ProgressSteps.
         [depend de] tokens et utilitaires de globals.css (.glass, .glass-strong, .btn-accent,
         .press-spring, rounded-card/panel/pill, duration-fast/slow, ease-glass)
         Button [utilise] framer-motion (appui ressort, useReducedMotion)
         Pas encore consommees par les pages : seule la vitrine /dev/ui les utilise.
UTILITY  Vitrine UI — /dev/ui (src/app/dev/ui/page.tsx + UiShowcase.tsx) — HORS groupe (app),
         notFound() si NODE_ENV=production (donc 404 aussi sur les previews Vercel), non liee.
```

## Notes importantes (corrigees — etat reel du code)

1. **Des hooks custom existent** — `src/hooks/` contient `useUserStatus` et `usePushNotifications`. *(ancienne note « pas de hooks custom » : fausse)*
2. **Pas de state management global** — toujours `useState` local + 2 hooks. *(confirme)*
3. **`slugify()` est factorisee** dans `src/lib/utils.ts`, importee par 3 routes. *(ancienne note « dupliquee » : fausse)*
4. **Resend non connecte** — dependance installee, aucun email envoye. *(confirme)*
5. **L'admin API existe** — `/api/admin` (GET/PATCH) + back-office `/admin`, autorisation `profiles.is_admin`. *(ancienne note « pas d'admin API » : fausse)*
6. **Pas d'edit projet** — un projet se cree (POST) et se supprime (DELETE), pas d'UPDATE expose. *(confirme)*
7. **`Navbar.tsx` n'existe plus** — le fichier a ete supprime (remplace par AppShell). *(ancienne entree ORPHELIN : obsolete)*
8. **`database.ts` est desormais la source de verite** (15 tables, profiles 35 col., projects 12 col., introspecte). En revanche **`supabase/schema.sql` reste en retard** (5 tables seulement) et doit etre regenere — voir docs/database.md.
9. **`account_type` (ROLE) et `plan` contraints par CHECK** — `account_type` ∈ {talent, creator, recruiter} (defaut talent, `member` supprime), `plan` ∈ {free, pro}. **Role et plan totalement independants depuis le 10/08/2026** : la regle `recruiter ⇒ pro` n'existe plus (`approve_recruiter` ne donne plus le Pro). Restent NON contraints : `projects.status`, `recruiter_status`, `display_name_preference`, `show_*_to`, statuts invitations/credits/reports/waitlist (dette technique).
