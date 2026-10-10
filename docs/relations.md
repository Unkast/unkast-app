# Unkast — Relations

> Mis a jour 2026-06-13 (audit). Les relations du MVP ci-dessous restent valides, MAIS la couverture
> est partielle : les modules **messages, credits, invitations, admin, pro, moi, suspended, notifications**
> ne figuraient pas et sont ajoutes en fin de fichier. Correction : `AppShell` est utilise par le
> **layout du groupe** `(app)/layout.tsx`, pas par le `layout.tsx` racine.

## Table des relations

| Source | Type de relation | Destination |
|--------|-----------------|-------------|
| `(app)/layout.tsx` | [utilise] | `AppShell` |
| `layout.tsx` (racine) | [utilise] | `globals.css`, metadata, PWA manifest |
| `AppShell` / `layout` | [utilise] | `SplashScreen` |
| `AppShell` | [depend de] | `next/navigation` (usePathname) |
| `AppShell` | [utilise] | `framer-motion` |
| `AppShell` | [utilise] | `LiquidDock` (app installee), `MobileTabBar` (navigateur), `Avatar` |
| `MobileTabBar` | [depend de] | `LiquidDock` (type `DockItem`), `globals.css` (`.glass-strong`) |
| `messages/[id]/page.tsx` | [depend de] | `AppShell` (header et navigation masques en mobile, hauteur 100dvh) |
| `LiquidDock` | [depend de] | `globals.css` (tokens accent, `duration-slower`, `ease-dock`, regle reduced motion) |
| `SplashScreen` | [depend de] | `/public/splash.mp4` |
| `SplashScreen` | [depend de] | `sessionStorage` |
| `proxy.ts` (ex-`middleware.ts`) | [utilise] | `supabase/middleware.ts` |
| `supabase/middleware.ts` | [utilise] | `@supabase/ssr` |
| `supabase/server.ts` | [utilise] | `@supabase/ssr` |
| `supabase/server.ts` | [depend de] | `next/headers` (cookies) |
| `supabase/client.ts` | [utilise] | `@supabase/ssr` |
| `constants.ts` | [utilise] | `types/database.ts` (ProjectCategory) |
| `motion.tsx` | [utilise] | `framer-motion` |
| `layout.tsx` (racine) | [depend de] | `globals.css` (`.bg-canvas-halos` sur le `body`) |
| `ui/*` (Button, Chip, Badge, GlassCard, Field, ProgressSteps, Select, Toggle, Toast) | [depend de] | `globals.css` (tokens et utilitaires verre) |
| `ui/Toast` | [utilise] | `framer-motion`, `react-dom` (createPortal) |
| `layout.tsx` (racine, script inline) | [declenche] | classe `.lite` sur `<html>` (Android) → `globals.css` (verre sans flou) |
| `ui/Button` | [utilise] | `framer-motion` (whileTap, useReducedMotion), `next/link` (prop `href`) |
| `dev/ui/UiShowcase` | [utilise] | `ui/*`, `motion.tsx` (EnterList, EnterItem, cardSpring) |
| --- | --- | --- |
| **Feed** | | |
| `(app)/feed/page.tsx` | [utilise] | `HeroCarousel` |
| `(app)/feed/page.tsx` | [utilise] | `HomeAnimations` (Section, AnimatedCard) |
| `(app)/feed/page.tsx` | [utilise] | `ConversionBanner` |
| `(app)/feed/page.tsx` | [utilise] | `supabase/server.ts` |
| `(app)/feed/page.tsx` | [utilise] | `constants.ts` |
| `(app)/feed/page.tsx` | [persiste dans] | `profiles` (lecture) |
| `(app)/feed/page.tsx` | [persiste dans] | `projects` (lecture) |
| `(app)/feed/page.tsx` | [persiste dans] | `profile_roles` (lecture) |
| `(app)/feed/page.tsx` | [persiste dans] | `project_credits` (lecture) |
| `HeroCarousel` | [utilise] | `framer-motion` (motion, AnimatePresence) |
| `HeroCarousel` | [utilise] | `constants.ts` (CATEGORY_LABELS, CATEGORY_COLORS) |
| `HomeAnimations` | [utilise] | `framer-motion` |
| `HomeAnimations` | [utilise] | `motion.tsx` (enterUp, enterFade, cardSpring) |
| `(app)/feed/page.tsx` | [utilise] | `ui/GlassCard` |
| `ConversionBanner` | [utilise] | `ui/Button` |
| `HeroCarousel` | [utilise] | `ui/Button` (liens) |
| `HeroCarousel`, `feed/FilmRow` | [utilise] | `FilmPoster` (`shareKey`), `FilmLink`, `FilmMeta`, `lib/film-transition` |
| `(app)/feed/page.tsx` | [utilise] | `feed/FilmRow`, `FilmLink` (`RestoreFilmScroll`) |
| `ProjetClient`, `skeletons/ProjectSkeleton` | [utilise] | `FilmLink` (`FilmPlayerFrame`) : meme nom de transition que la vignette cliquee |
| `ProjetClient` | [utilise] | `FilmPoster` (`player`), `lib/film-transition` (`backWithTransition`) |
| `FilmPoster` | [depend de] | `lib/film-transition` (vignette cliquee), `next/image` |
| `VideoFacade`, `RechercheClient`, `categories/[slug]/page.tsx`, `moi/parts.tsx` | [utilise] | `FilmPoster` |
| `FilmPoster`, `HeroCarousel`, `ProjetClient` | [depend de] | `globals.css` (`.film-ambient`, `.hero-progress`, regles `::view-transition-*`) |
| `AppShell` (champ de recherche desktop, loupe mobile, Ctrl K) | [utilise] | `SearchAssistant` (chargement a la demande) |
| `SearchAssistant` | [declenche] | `POST /api/search` (seule source de donnees), `/recherche?q=` (« Chercher dans Explorer ») |
| `SearchAssistant` | [utilise] | `lib/assistant.ts`, `constants.ts` (listes fermees), `Avatar`, `FilmPoster` |
| `/api/search` | [utilise] | `lib/assistant.ts` (`withFeminine`), `constants.ts` (validation des filtres) |
| `/api/search` | [persiste dans] | `profiles.playing_ages`, `role_type`, `languages` (lecture, migration `20261016`) |
| `MoiClient`, `rejoindre/finaliser/FinaliserClient` | [utilise] | `CastingFieldsForm` → `PATCH /api/dashboard/profile` |
| `MoiClient`, `ProfileClient` | [utilise] | `CastingSummary` |
| `RechercheClient` | [depend de] | `recherche/page.tsx` (`initialQuery`, lu dans `?q=`) |
| `lib/film-team.ts` | [persiste dans] | `profiles.avatar_url` (lecture, `team_preview` du bloc a la une) |
| `ConversionBanner` | [depend de] | `AppShell` (hauteurs de navigation mobile, classe `app-installed`, defilement du `<main>`) |
| `AppShell` (`<main>`) | [depend de] | `globals.css` (`.pb-tabbar` : reserve de la navigation mobile pour toutes les pages) |
| --- | --- | --- |
| **Profil public** | | |
| `profil/[slug]/page.tsx` | [utilise] | `ProfileClient` |
| `profil/[slug]/page.tsx` | [utilise] | `supabase/server.ts` |
| `profil/[slug]/page.tsx` | [utilise] | `constants.ts` |
| `profil/[slug]/page.tsx` | [persiste dans] | `profiles` (lecture) |
| `profil/[slug]/page.tsx` | [persiste dans] | `profile_roles` (lecture) |
| `profil/[slug]/page.tsx` | [persiste dans] | `projects` (lecture) |
| `profil/[slug]/page.tsx` | [persiste dans] | `project_credits` (lecture) |
| `ProfileClient` | [utilise] | `VideoEmbed` |
| `ProfileClient` | [utilise] | `ContactModal` |
| `ProfileClient` | [utilise] | `motion.tsx` (EnterList, EnterItem, enterUp, enterFade, cardSpring) |
| `ProfileClient` | [utilise] | `ui/Button`, `ui/Chip`, `ui/Badge`, `ui/Field` |
| `ProfileClient` | [utilise] | `VideoFacade` |
| `ProfileClient` | [utilise] | `framer-motion` |
| --- | --- | --- |
| **Page projet** | | |
| `projet/[slug]/page.tsx` | [utilise] | `ProjetClient` |
| `projet/[slug]/page.tsx` | [utilise] | `supabase/server.ts` |
| `projet/[slug]/page.tsx` | [utilise] | `constants.ts` |
| `projet/[slug]/page.tsx` | [persiste dans] | `profiles` (lecture) |
| `projet/[slug]/page.tsx` | [persiste dans] | `profile_roles` (lecture) |
| `projet/[slug]/page.tsx` | [persiste dans] | `projects` (lecture) |
| `projet/[slug]/page.tsx` | [persiste dans] | `project_credits` (lecture) |
| `ProjetClient` | [utilise] | `VideoEmbed` |
| `ProjetClient` | [utilise] | `motion.tsx` (EnterList, EnterItem, ModalBackdrop) |
| `ProjetClient` | [utilise] | `ui/Button`, `ui/Badge`, `ui/Field`, `ui/GlassCard` |
| --- | --- | --- |
| **Recherche** | | |
| `RechercheClient` | [declenche] | `GET /api/search` |
| `RechercheClient` | [utilise] | `constants.ts` |
| `RechercheClient` | [utilise] | `framer-motion` |
| `RechercheClient` | [utilise] | `motion.tsx` (EnterList, EnterItem) |
| `RechercheClient` | [utilise] | `ui/Badge`, `ui/Chip`, `ui/Field`, `ui/GlassCard` |
| `loading.tsx` (feed, profil, projet, recherche) | [utilise] | `skeletons/*` (cales sur la mise en page de chaque page) |
| `GET /api/search` | [persiste dans] | `profiles` (lecture) |
| `GET /api/search` | [persiste dans] | `profile_roles` (lecture) |
| `GET /api/search` | [persiste dans] | `projects` (lecture) |
| --- | --- | --- |
| `RechercheClient` | [depend de] | `ui/Field` (`autoFocus` a l'entree en mode Rechercher) |
| --- | --- | --- |
| **Refonte vague 2 (chantier 6, 08/10/2026)** | | |
| `RejoindreClient` | [utilise] | `RoleSelector`, `motion.tsx`, `ui/Badge`, `ui/Button`, `ui/Chip`, `ui/Field`, `ui/GlassCard`, `ui/ProgressSteps`, `ui/Select` |
| `ConnexionClient`, `auth/confirm/page.tsx` | [utilise] | `motion.tsx`, `ui/Button`, `ui/Field`, `ui/GlassCard` |
| `MoiClient` | [utilise] | `moi/parts.tsx`, `RoleSelector`, `AvatarUpload`, `motion.tsx`, `ui/Badge`, `ui/Button`, `ui/Chip`, `ui/Field`, `ui/GlassCard`, `ui/Select`, `ui/Toast`, `ui/Toggle` |
| `RecruitmentSpace` | [utilise] | `motion.tsx`, `ui/Button`, `ui/Chip`, `ui/Field` |
| `RecruitmentSpace` | [depend de] | `AppShell` (hauteurs de navigation mobile, classe `app-installed`) |
| `messages/page.tsx` | [utilise] | `motion.tsx`, `ui/Button`, `ui/Field`, `ui/GlassCard`, `Avatar` |
| `messages/[id]/page.tsx` | [utilise] | `ui/Button` |
| `messages/[id]/page.tsx` | [depend de] | `globals.css` (`.lite`, `--accent-gradient`) |
| `pro/page.tsx` | [utilise] | `motion.tsx`, `ui/Badge`, `ui/Button`, `ui/Field`, `ui/GlassCard` |
| `pro/success`, `pro/cancel` | [utilise] | `motion.tsx`, `ui/Button`, `ui/GlassCard` |
| `categories/[slug]/page.tsx` | [utilise] | `motion.tsx`, `ui/Badge`, `ui/Button`, `ui/GlassCard` |
| `RoleSelector` | [utilise] | `ui/Button`, `ui/Chip`, `ui/Field`, `constants.ts`, `react-dom` (createPortal) |
| `ProfileClient`, `ProjetClient` | [utilise] | `RoleSelector` (singleSelect, dans une `ModalBackdrop`) |
| `AvatarUpload` | [utilise] | `ui/Button`, `ui/Toast`, `react-dom` (createPortal) |
| --- | --- | --- |
| **Inscription** | | |
| `RejoindreClient` | [declenche] | `POST /api/signup` |
| `RejoindreClient` | [utilise] | `constants.ts` |
| `POST /api/signup` | [persiste dans] | `auth.users` (ecriture) |
| `POST /api/signup` | [persiste dans] | `profiles` (ecriture) |
| `POST /api/signup` | [persiste dans] | `profile_roles` (ecriture) |
| `POST /api/signup` | [persiste dans] | `projects` (ecriture) |
| `POST /api/signup` | [persiste dans] | `project_credits` (ecriture) |
| --- | --- | --- |
| **Dashboard** | | |
| `DashboardClient` | [declenche] | `GET /api/dashboard/profile` |
| `DashboardClient` | [declenche] | `PATCH /api/dashboard/profile` |
| `DashboardClient` | [declenche] | `GET /api/dashboard/projects` |
| `DashboardClient` | [declenche] | `POST /api/dashboard/projects` |
| `DashboardClient` | [declenche] | `DELETE /api/dashboard/projects` |
| `DashboardClient` | [declenche] | `GET /api/dashboard/contacts` |
| `DashboardClient` | [declenche] | `PATCH /api/dashboard/contacts` |
| `DashboardClient` | [utilise] | `constants.ts` |
| `GET /api/dashboard/profile` | [persiste dans] | `profiles` (lecture) |
| `GET /api/dashboard/profile` | [persiste dans] | `profile_roles` (lecture) |
| `PATCH /api/dashboard/profile` | [persiste dans] | `profiles` (ecriture) |
| `PATCH /api/dashboard/profile` | [persiste dans] | `profile_roles` (ecriture) |
| `POST /api/dashboard/projects` | [persiste dans] | `projects` (ecriture) |
| `POST /api/dashboard/projects` | [persiste dans] | `project_credits` (ecriture) |
| `DELETE /api/dashboard/projects` | [persiste dans] | `projects` (suppression) |
| `PATCH /api/dashboard/contacts` | [persiste dans] | `contact_requests` (ecriture) |
| --- | --- | --- |
| **Contact** | | |
| `ContactModal` | [declenche] | `POST /api/contact` |
| `ContactModal` | [utilise] | `motion.tsx` (ModalBackdrop) |
| `POST /api/contact` | [persiste dans] | `contact_requests` (ecriture) |

## Modules ajoutes (audit 2026-06-13)

Relations route → table code-verifiees (voir docs/api-routes.md pour le detail des methodes).

| Source | Type de relation | Destination |
|--------|-----------------|-------------|
| **Messagerie** | | |
| `(app)/messages/*` | [declenche] | `/api/messages*` |
| `POST /api/messages` | [persiste dans] | `conversations`, `messages` (ecriture), `profiles` (lecture) |
| `GET /api/messages/[conversationId]` | [persiste dans] | `messages` (lecture + is_read) |
| **Credits** | | |
| `ProjetClient` / dashboard | [declenche] | `/api/credits/request`, `/api/credits/[id]` |
| `POST /api/credits/request` | [persiste dans] | `credit_requests` (ecriture) |
| `PATCH /api/credits/[id]` | [persiste dans] | `credit_requests`, `project_credits` (ecriture) |
| **Invitations** | | |
| `POST /api/invitations/project` | [persiste dans] | `project_invitations` (ecriture) |
| `PATCH /api/invitations/project/[id]` | [persiste dans] | `project_invitations`, `project_credits` (ecriture) |
| **Reports / Moderation** | | |
| `ReportModal` | [declenche] | `POST /api/reports` |
| `POST /api/reports` | [persiste dans] | `reports`, `admin_logs` (ecriture) |
| **Admin** | | |
| `AdminClient` (`/admin`, `src/app/admin/`) | [declenche] | `GET/PATCH /api/admin` |
| `src/app/admin/(panel)/layout.tsx` (garde serveur), `src/app/admin/mfa/page.tsx` | [depend de] | `lib/adminGuard.ts` (`getAdminId()`) |
| `/api/admin` | [persiste dans] | `profiles`, `projects`, `reports`, `admin_logs` (ecriture) |
| `/api/admin` | [depend de] | `lib/adminGuard.ts` (`getAdminId()`) → `lib/supabase/admin.ts` (service role) + `profiles.is_admin` |
| `AppShell` (menu utilisateur desktop) | [utilise] | `GET /api/me` (`is_admin`) pour afficher le lien « Administration » |
| **Pro / statut** | | |
| `pro/page.tsx`, `ConversionBanner` | [utilise] | `useUserStatus` (lit `profiles.plan`) |
| **Avatar** | | |
| `AvatarUpload` | [declenche] | `POST/DELETE /api/avatar` (Storage `avatars` + `profiles`) |
| **Notifications push** | | |
| `usePushNotifications` | [declenche] | `POST /api/notifications/register` |
| `/api/notifications/register` | [persiste dans] | `push_tokens` (ecriture) |
| `lib/push.ts` | [persiste dans] | `push_tokens` (lecture) |
| **Inscription (maj)** | | |
| `POST /api/signup` | [persiste dans] | `credit_requests` (ecriture, en plus des tables d'origine) |
| `auth/callback/route.ts` | [utilise] | `lib/utils.ts` (slugify), `profiles`, `profile_roles` |
| **Securite** | | |
| `/api/signup`, `/api/waitlist` | [depend de] | `lib/rate-limit.ts` (RPC `check_rate_limit`) |

## Gestion des films (lots 2 et 3, 08/10/2026)

| Source | Destination | Nature |
|---|---|---|
| `moi/FilmsSection`, `FilmCard`, `PublishForm` | `/api/dashboard/projects` | liste, publication, modification, visibilité, suppression |
| `moi/FilmManagers`, `projet/ProjetClient` | `/api/projects/[id]/managers`, `/transfer` | co-gestion et transfert |
| `moi/DuplicateFilm`, `projet/ClaimModal` | `/api/projects/[id]/claims`, `/api/credits/request` | revendication, signalement, demande de crédit |
| `moi/CareerSection` | `/api/dashboard/career` | Parcours |
| `profil/[slug]/page` | `career_entries` | lecture du Parcours ; signalement par `ReportModal` (cible `career_entry`) |
| `feed`, `categories`, `recherche`, `profil`, `projet` | `lib/film-team` → `project_credits` ou `public_project_credits` | réalisateur et équipe |
| `rejoindre/RejoindreClient` | `/api/signup`, `/api/search` (`director_name`) | film à l'inscription avec déclaration |
| `admin/AdminClient` | `/api/admin` (`tab=films`, `tab=claims`, `tab=reports`) | validation, modifiés récemment, sans Responsable, revendications |
| routes de publication | RPC `publish_project` (service role) | seule voie de création d'un film |

## Relations base de donnees

| Table source | FK | Table cible | ON DELETE |
|---|---|---|---|
| `profiles.id` | → | `auth.users.id` | CASCADE |
| `profile_roles.profile_id` | → | `profiles.id` | CASCADE |
| `projects.profile_id` | → | `profiles.id` | CASCADE |
| `project_credits.project_id` | → | `projects.id` | CASCADE |
| `project_credits.profile_id` | → | `profiles.id` | SET NULL |
| `contact_requests.to_profile_id` | → | `profiles.id` | CASCADE |

| `lib/adminGuard.ts`, `lib/supabase/middleware.ts` | [depend de] | `lib/adminSession.ts` (`sessionStrength` : mot de passe + aal2) |
| `lib/supabase/server.ts` (`createClient`) | [depend de] | cookie `unkast_view` (`lib/adminSession.ts`) : vue visiteur = session ignoree |
| `lib/auth-guard.ts` (`getActiveUser`) | [bloque] | compte `account_type='admin'` (403 sur toutes les routes d'ecriture) |
| `admin/(panel)/ViewAs` | [declenche] | cookie de vue puis `/feed` ; `AppShell` (`adminView`) affiche le bandeau de retour |


## Séries (lot 10, 10/10/2026)

| Source | Type de relation | Destination |
|---|---|---|
| `moi/PublishForm`, `POST /api/dashboard/projects` | [utilise] | `lib/utils.ts` (`extractPlaylistId`, `playlistUrl`), `lib/oembed.ts` (`fetchPlaylistMeta`, `playlistRefusal`) |
| `lib/oembed.ts` (`fetchPlaylistMeta`) | [depend de] | API YouTube Data v3 (`YOUTUBE_API_KEY`) |
| `moi/FilmCard` | [declenche] | `POST /api/projects/[id]/episodes` |
| `POST /api/projects/[id]/episodes` | [persiste dans] | `projects.episode_count`, `projects.episodes` (service role) |
| `ProjetClient` | [utilise] | `VideoEmbed` (`onEnded`), `lib/utils.ts` (`episodeUrl`), `projects.episodes` |
| `FilmMeta` (`episodes`) | [utilise par] | `feed/FilmRow`, `RechercheClient`, `ProfileClient`, `ProjetClient` |
| `feed/page.tsx`, `/api/search`, `categories/[slug]/page.tsx`, `profil/[slug]/page.tsx` | [persiste dans] | `projects.episode_count` (lecture : migration `20261023` requise) |
