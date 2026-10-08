# Unkast — Composants critiques

> Mis a jour 2026-06-14. Ajout des partages apparus hors MVP : `lib/utils.ts` (slugify),
> `lib/supabase/admin.ts` (service role), `lib/rate-limit.ts`, `ReportModal`, `AvatarUpload`,
> `Avatar` (affichage avatar unifie, 9 surfaces).

Composants / modules utilises par 3+ features.

## AppShell

- **Fichier** : `src/components/AppShell.tsx`
- **Role** : Shell principal de l'app (sidebar desktop, navigation mobile `LiquidDock` ou `MobileTabBar` selon `html.app-installed`, header)
- **Hauteur reservee en bas (mobile)** : `<main>` porte `.pb-tabbar` (globals.css) et reserve seul la navigation pour toutes les pages (chantier 5, 07/10/2026) : 56 px + safe area sous la barre plate du navigateur, 92 px + safe area sous le dock de l'app installee (88 px, collerette comprise, + 4 px d'air), 0 en desktop. **Les pages ne reservent plus rien** : ne pas remettre de `.pb-tabbar` ni de `pb-16` dans une page, la reserve serait doublee. Exception : `/messages/[id]`, ou la navigation est masquee et `<main>` ne reserve rien (la page gere `.safe-bottom`). Les elements `fixed` en bas des pages doivent se placer au-dessus de cette hauteur (`ConversionBanner` : 68 px + safe area en navigateur, 100 px + safe area en app installee ; la barre de `RecruitmentSpace` en `bottom: 90` date de l'ancienne tab bar). `ConversionBanner` ecoute le defilement de ce `<main>` (`document.querySelector("main")`) : ne pas deplacer le conteneur qui defile sans l'adapter
- **Consommateurs** : TOUTES les pages du groupe (via `src/app/(app)/layout.tsx`). `/admin` n'en fait **plus** partie (espace separe `src/app/admin/` depuis le 07/08/2026, layout propre sans AppShell)
- **Risque si modifie** : **CRITIQUE** — casse la navigation de toute l'app
- **Note admin** : le menu utilisateur desktop affiche un lien « Administration » si `is_admin` (fetch `GET /api/me` au montage quand connecte — affichage seulement, la garde reelle est le layout serveur de `/admin`)

## Avatar

- **Fichier** : `src/components/Avatar.tsx`
- **Role** : Affichage unifie d'une photo de profil avec fallback initiales. Source unique de verite — evite que des copies oublient la branche `<img>` (bug historique : sidebar desktop AppShell + resultats recherche affichaient les initiales malgre un `avatar_url` existant). Props : `url`, `name`, `size`, `shape` (`circle`/`rounded`), surcharges `style`/`className`. Fallback initiales **uniquement si `url` falsy** ; gere le `?t=timestamp` de l'upload nativement.
- **Consommateurs** : `AppShell` (sidebar + tab mobile), `feed/page`, `RechercheClient`, `ProfileClient`, `ProjetClient`, `MoiClient`, `RecruitmentSpace`, `messages/page`, `messages/[id]`, `DashboardClient` (~9 surfaces)
- **Risque si modifie** : **ELEVE** — change le rendu de tous les avatars de l'app. Ne pas confondre avec `AvatarUpload` (edition/upload de sa propre photo).

## motion.tsx (FadeInView, ModalBackdrop, cardHover, variants)

- **Fichier** : `src/components/motion.tsx`
- **Role** : Primitives d'animation partagees
- **Consommateurs** : `HomeAnimations`, `ProfileClient`, `ProjetClient`, `RechercheClient`, `ContactModal`, `dev/ui/UiShowcase` ; depuis le chantier 6 : `RejoindreClient`, `ConnexionClient`, `auth/confirm`, `MoiClient`, `RecruitmentSpace`, `messages/page`, `pro/*`, `categories/[slug]/page`
- **Risque si modifie** : **CRITIQUE** — affecte les animations de presque toutes les pages
- **Chantier 5** : `enterUp` / `enterFade` finissent sur `filter: none` (`transitionEnd`) : un `.glass` place dans un `EnterItem` floute bien les halos du fond. `ModalBackdrop` : panneau `.glass-strong` teinte, `rounded-panel`

## ui/ (Button, Chip, Badge, GlassCard, Field)

- **Fichiers** : `src/components/ui/*`
- **Role** : briques du style verre liquide
- **API** : `Button` (variant `accent | light | glass | dashed | icon`, size `sm | md | lg`, `href` → lien next/link) ; `Chip` (variant `filter | static`, `selected`) ; `Badge` (variant `verified | pro | available | neutral | pending`) ; `Field` (`label`, `icon`, `onClear`, `multiline`, size `md | lg`) ; `GlassCard` (`strong`, radius `card | panel`)
- **Consommateurs** : `Button` → `ConversionBanner`, `HeroCarousel`, `ProfileClient`, `ProjetClient` ; `Chip` → `ProfileClient`, `RechercheClient` ; `Badge` → `ProfileClient`, `ProjetClient`, `RechercheClient` ; `Field` → `ProfileClient`, `ProjetClient`, `RechercheClient` ; `GlassCard` → `feed/page`, `ProjetClient`, `RechercheClient` ; toutes → `dev/ui/UiShowcase`
- **Consommateurs ajoutes au chantier 6 (08/10/2026)** : `RejoindreClient` (toutes + `ProgressSteps`), `ConnexionClient`, `auth/confirm`, `MoiClient`, `RecruitmentSpace`, `moi/parts`, `messages/page`, `messages/[id]`, `pro/*`, `categories/[slug]/page`, `RoleSelector`, `AvatarUpload`
- **Risque si modifie** : **CRITIQUE** — change le rendu de presque toutes les pages
- **Manques connus (contournes en local, a arbitrer)** : pas de Chip retirable, pas de brique Select ni Toggle ni Toast, pas de variant Badge « refuse » ni « publie », pas de Button 40 px ni pleine largeur ; `ModalBackdrop` n'est pas protege contre le drag-select
- **Ajouts du 07/10/2026 (verre liquide, purement additifs)** : `cardSpring`, `listStagger`, `enterUp`, `enterFade`, `EnterList`, `EnterItem`

## globals.css (tokens, utilitaires verre, regle reduced motion)

- **Fichier** : `src/app/globals.css`
- **Role** : tokens Tailwind (`@theme`), utilitaires `.glass` / `.glass-strong` / `.btn-accent` / `.text-sheen` (dans `@layer components`), fond `.bg-canvas-halos` pose sur le `body`, regle globale `prefers-reduced-motion`
- **Consommateurs** : toute l'app (via `layout.tsx` racine), `src/components/ui/*`
- **Risque si modifie** : **CRITIQUE** — les regles hors `@layer` (`button`, `a`, `input:focus`, reduced motion) l'emportent sur toutes les classes Tailwind

## VideoEmbed

- **Fichier** : `src/components/VideoEmbed.tsx`
- **Role** : Wrapper SSR-safe de react-player pour embeds Vimeo/YouTube
- **Consommateurs** : `ProjetClient` (direct), `ProfileClient` (via `VideoFacade`)
- **Risque si modifie** : **ELEVE** — casse l'affichage video sur les 2 pages principales
- **Chantier 6** : conteneur transparent avant le chargement du lecteur (plus de `bg-card`), etat `mounted` supprime (`dynamic` avec `ssr: false` suffit)

## RoleSelector

- **Fichier** : `src/components/RoleSelector.tsx`
- **Role** : selecteur de metiers (familles, recherche, metier libre). Refait au chantier 6 (08/10/2026) : selection en Chip retirables, la premiere = « Titre principal », feuille en verre rendue par `createPortal(document.body)`
- **API (a ne pas casser)** : `selectedRoles`, `onChange`, `maxSelection` (defaut 5), `placeholder`, `singleSelect`. L'ordre de `selectedRoles` n'est jamais modifie (ajout en fin, retrait par filtre) : le premier element est le titre principal
- **Consommateurs** : `RejoindreClient`, `MoiClient`, `ProfileClient` et `ProjetClient` (singleSelect, dans une `ModalBackdrop`)
- **Risque si modifie** : **ELEVE** — 4 features
- **Comportement herite** : en `singleSelect`, une fois un metier choisi, les autres sont desactives (il faut le retirer pour en changer)

## ContactModal

- **Fichier** : `src/components/ContactModal.tsx`
- **Role** : Modale de contact (nom, email, sujet, message)
- **Consommateurs** : `ProfileClient`
- **Risque si modifie** : **MODERE** — affecte uniquement la page profil

## SplashScreen

- **Fichier** : `src/components/SplashScreen.tsx`
- **Role** : Splash video au premier lancement de session
- **Consommateurs** : `layout.tsx` (global)
- **Risque si modifie** : **ELEVE** — affecte la premiere impression de toute l'app

## constants.ts

- **Fichier** : `src/lib/constants.ts`
- **Role** : Couleurs/labels de categories, `MAX_PROJECTS_FREE` (= 3), `ACCOUNT_TYPES`, listes de roles (`ROLES_BY_CATEGORY`, `ALL_ROLES`, `ROLE_CATEGORIES`, `POPULAR_ROLES`)
- **Consommateurs** : feed, `ProfileClient`, `ProjetClient`, `RechercheClient`, `RejoindreClient`, `DashboardClient`, `RoleSelector`, `api/dashboard/projects`, `api/signup`
- **Risque si modifie** : **CRITIQUE** — utilise dans quasiment tous les fichiers

## lib/utils.ts (slugify)

- **Fichier** : `src/lib/utils.ts`
- **Role** : `slugify()` partage (generation de slugs profil/projet)
- **Consommateurs** : `api/signup`, `api/dashboard/projects`, `(app)/auth/callback`
- **Risque si modifie** : **ELEVE** — un changement de logique change les slugs generes (URLs)

## lib/supabase/admin.ts (service role)

- **Fichier** : `src/lib/supabase/admin.ts`
- **Role** : Client Supabase **service role** — bypass RLS. Reserve aux operations admin.
- **Consommateurs** : `api/admin`, `api/reports`, flux de moderation
- **Risque si modifie** : **CRITIQUE / SECURITE** — toute fuite de ce client hors contexte admin = contournement RLS

## lib/rate-limit.ts

- **Fichier** : `src/lib/rate-limit.ts`
- **Role** : `checkRateLimit()` via RPC `check_rate_limit` (fail-open si migration absente)
- **Consommateurs** : `api/signup`, `api/waitlist`
- **Risque si modifie** : **ELEVE** — protege les endpoints publics contre l'abus

## ReportModal

- **Fichier** : `src/components/ReportModal.tsx`
- **Role** : Signalement de profil/projet/message
- **Consommateurs** : `ProfileClient`, `ProjetClient` (+ messagerie)
- **Risque si modifie** : **MODERE** — affecte le flux de moderation

## AvatarUpload

- **Fichier** : `src/components/AvatarUpload.tsx`
- **Role** : Upload/suppression d'avatar (Storage `avatars`)
- **Consommateurs** : `MoiClient` (`DashboardClient` aussi, mais inatteignable : `/dashboard` redirige vers `/moi`)
- **Risque si modifie** : **MODERE**
- **Chantier 6** : feuille, recadreur et toast rendus par `createPortal(document.body)` ; props inchangees

## types/database.ts

- **Fichier** : `src/types/database.ts`
- **Role** : Source unique de verite pour tous les types TypeScript et le schema Supabase
- **Consommateurs** : Tous les fichiers du projet
- **Risque si modifie** : **CRITIQUE** — casse potentiellement tout le typage de l'app
