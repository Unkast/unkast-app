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

CORE  Layout app (src/app/(app)/layout.tsx)
  [utilise] AppShell (enveloppe toutes les pages du groupe (app))

CORE  AppShell (src/components/AppShell.tsx)
  Sidebar desktop + bottom tab mobile + header. Indicateur anime (framer-motion layoutId).
  [utilise] framer-motion ; [depend de] next/navigation (usePathname)

CORE  SplashScreen (src/components/SplashScreen.tsx)
  Video /public/splash.mp4, une fois par session (sessionStorage).

CORE  Middleware (src/middleware.ts)
  Rafraichit la session Supabase + applique les redirections de garde.
  [utilise] src/lib/supabase/middleware.ts
  Logique : lit profiles.is_admin et profiles.is_suspended (ex. redirige vers /suspended).
  NB : Next 16 deprecie "middleware" au profit de "proxy".

CORE  Supabase Server Client (src/lib/supabase/server.ts)   — SSR/API (cookies)
CORE  Supabase Browser Client (src/lib/supabase/client.ts)  — navigateur
CORE  Supabase Admin Client (src/lib/supabase/admin.ts)     — service role (bypass RLS, usage admin)

CORE  Constants (src/lib/constants.ts)
  CATEGORY_COLORS, CATEGORY_LABELS, MAX_PROJECTS_FREE (= 2),
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

UTILITY  lib/utils.ts        — slugify() PARTAGE (utilise par signup, dashboard/projects, auth/callback)
UTILITY  lib/rate-limit.ts   — checkRateLimit() (RPC check_rate_limit, fail-open)
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
  Profil (view/edit), projets (CRUD, max 2 gratuit), contacts, credits.
  [declenche] /api/dashboard/{profile,projects,contacts,credits}, /api/avatar

FEATURE  Mon compte — /moi (src/app/(app)/moi/ + MoiClient)

FEATURE  Messagerie — /messages, /messages/[id] (src/app/(app)/messages/)
  Conversations + messages. Quotas (5 conv/j, anti-coordonnees, relance 48h).
  [declenche] /api/messages*  [persiste dans] conversations, messages

FEATURE  Pro / Freemium — /pro (src/app/(app)/pro/)
  Page offre Pro. NB : aucun paiement (Stripe absent), prix 9,99€ non present en code.
  [utilise] useUserStatus

FEATURE  Suspendu — /suspended (src/app/(app)/suspended/)
  Ecran pour comptes is_suspended (lit suspended_reason).

FEATURE  Admin — /admin (src/app/(app)/admin/ + AdminClient)
  Back-office : recruteurs, reports, users, films. [declenche] GET/PATCH /api/admin
  Onglets : approbation recruteur, moderation reports, suspension, set_pro, approbation films.
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
9. **`account_type` (ROLE) et `plan` contraints par CHECK** — `account_type` ∈ {talent, creator, recruiter} (defaut talent, `member` supprime), `plan` ∈ {free, pro}. Regle `recruiter ⇒ pro` cote code. Restent NON contraints : `projects.status`, `recruiter_status`, `display_name_preference`, `show_*_to`, statuts invitations/credits/reports/waitlist (dette technique).
