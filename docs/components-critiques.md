# Unkast — Composants critiques

> Mis a jour 2026-06-14. Ajout des partages apparus hors MVP : `lib/utils.ts` (slugify),
> `lib/supabase/admin.ts` (service role), `lib/rate-limit.ts`, `ReportModal`, `AvatarUpload`,
> `Avatar` (affichage avatar unifie, 9 surfaces).

Composants / modules utilises par 3+ features.

## AppShell

- **Fichier** : `src/components/AppShell.tsx`
- **Role** : Shell principal de l'app (sidebar desktop, bottom tab mobile, header)
- **Consommateurs** : TOUTES les pages du groupe (via `src/app/(app)/layout.tsx`)
- **Risque si modifie** : **CRITIQUE** — casse la navigation de toute l'app

## Avatar

- **Fichier** : `src/components/Avatar.tsx`
- **Role** : Affichage unifie d'une photo de profil avec fallback initiales. Source unique de verite — evite que des copies oublient la branche `<img>` (bug historique : sidebar desktop AppShell + resultats recherche affichaient les initiales malgre un `avatar_url` existant). Props : `url`, `name`, `size`, `shape` (`circle`/`rounded`), surcharges `style`/`className`. Fallback initiales **uniquement si `url` falsy** ; gere le `?t=timestamp` de l'upload nativement.
- **Consommateurs** : `AppShell` (sidebar + tab mobile), `feed/page`, `RechercheClient`, `ProfileClient`, `ProjetClient`, `MoiClient`, `RecruitmentSpace`, `messages/page`, `messages/[id]`, `DashboardClient` (~9 surfaces)
- **Risque si modifie** : **ELEVE** — change le rendu de tous les avatars de l'app. Ne pas confondre avec `AvatarUpload` (edition/upload de sa propre photo).

## motion.tsx (FadeInView, ModalBackdrop, cardHover, variants)

- **Fichier** : `src/components/motion.tsx`
- **Role** : Primitives d'animation partagees
- **Consommateurs** : `HomeAnimations`, `ProfileClient`, `ProjetClient`, `ContactModal`
- **Risque si modifie** : **ELEVE** — affecte les animations de 4+ pages

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
- **Role** : Couleurs/labels de categories, `MAX_PROJECTS_FREE` (= 2), `ACCOUNT_TYPES`, listes de roles (`ROLES_BY_CATEGORY`, `ALL_ROLES`, `ROLE_CATEGORIES`, `POPULAR_ROLES`)
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
