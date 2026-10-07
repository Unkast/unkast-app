# Unkast — Composants critiques

> Mis a jour 2026-06-14. Ajout des partages apparus hors MVP : `lib/utils.ts` (slugify),
> `lib/supabase/admin.ts` (service role), `lib/rate-limit.ts`, `ReportModal`, `AvatarUpload`,
> `Avatar` (affichage avatar unifie, 9 surfaces).

Composants / modules utilises par 3+ features.

## AppShell

- **Fichier** : `src/components/AppShell.tsx`
- **Role** : Shell principal de l'app (sidebar desktop, navigation mobile `LiquidDock` ou `MobileTabBar` selon `html.app-installed`, header)
- **Hauteur reservee en bas (mobile)** : app installee, le dock monte a 88 px + safe area (collerette comprise) : les pages reservent 56 px (`.pb-tabbar`), `<main>` ajoute 36 px. Navigateur, la barre plate fait 56 px + safe area : `.pb-tabbar` suffit. Exception : `/messages/[id]`, ou le dock est masque et la page ne reserve que la safe area (`.safe-bottom`). Les elements `fixed` en bas des pages doivent se placer au-dessus de cette hauteur (`ConversionBanner` est aligne depuis le chantier 4 : 68 px + safe area en navigateur, 100 px + safe area en app installee ; la barre de `RecruitmentSpace` en `bottom: 90` date de l'ancienne tab bar). `<main>` ne reserve PAS la barre : chaque page garde `.pb-tabbar` sur son wrapper racine (Feed, Profil, Projet, Recherche, Categories, Dashboard)
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
- **Consommateurs** : `HomeAnimations`, `ProfileClient`, `ProjetClient`, `RechercheClient`, `ContactModal`, `dev/ui/UiShowcase`
- **Risque si modifie** : **ELEVE** — affecte les animations de 4+ pages
- **Point d'attention** : `EnterItem` laisse un `filter: blur(0px)` en ligne apres l'entree ; un `.glass` enfant peut alors ne plus flouter les halos du fond. Dans le doute, poser le verre sur l'element anime lui-meme

## ui/ (Button, Chip, Badge, GlassCard, Field)

- **Fichiers** : `src/components/ui/*`
- **Role** : briques du style verre liquide
- **Consommateurs** (chantier 4, 07/10/2026) : `Button` → `ConversionBanner`, `ProfileClient`, `ProjetClient` ; `Chip` → `ProfileClient`, `RechercheClient` ; `Badge` → `ProfileClient`, `RechercheClient` ; `GlassCard` → `feed/page`, `ProjetClient`, `RechercheClient` ; toutes → `dev/ui/UiShowcase`. `HeroCarousel` recopie les classes de `Button` sur des `<Link>`
- **Risque si modifie** : **ELEVE** — change le rendu de Feed, Profil, Projet et Recherche
- **Ajouts du 07/10/2026 (verre liquide, purement additifs)** : `cardSpring`, `listStagger`, `enterUp`, `enterFade`, `EnterList`, `EnterItem`

## globals.css (tokens, utilitaires verre, regle reduced motion)

- **Fichier** : `src/app/globals.css`
- **Role** : tokens Tailwind (`@theme`), utilitaires `.glass` / `.glass-strong` / `.btn-accent` / `.text-sheen` (dans `@layer components`), fond `.bg-canvas-halos` pose sur le `body`, regle globale `prefers-reduced-motion`
- **Consommateurs** : toute l'app (via `layout.tsx` racine), `src/components/ui/*`
- **Risque si modifie** : **CRITIQUE** — les regles hors `@layer` (`button`, `a`, `input:focus`, reduced motion) l'emportent sur toutes les classes Tailwind

## VideoEmbed

- **Fichier** : `src/components/VideoEmbed.tsx`
- **Role** : Wrapper SSR-safe de react-player pour embeds Vimeo/YouTube
- **Consommateurs** : `ProfileClient`, `ProjetClient`
- **Risque si modifie** : **ELEVE** — casse l'affichage video sur les 2 pages principales

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
- **Consommateurs** : `DashboardClient`, `MoiClient`
- **Risque si modifie** : **MODERE**

## types/database.ts

- **Fichier** : `src/types/database.ts`
- **Role** : Source unique de verite pour tous les types TypeScript et le schema Supabase
- **Consommateurs** : Tous les fichiers du projet
- **Risque si modifie** : **CRITIQUE** — casse potentiellement tout le typage de l'app
