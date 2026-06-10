# Unkast — Composants critiques

Composants utilises par 3+ features.

## AppShell

- **Fichier** : `src/components/AppShell.tsx`
- **Role** : Shell principal de l'app (sidebar desktop, bottom tab mobile, header)
- **Consommateurs** : TOUTES les pages (via `layout.tsx`)
- **Risque si modifie** : **CRITIQUE** — casse la navigation de toute l'app

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
- **Role** : Couleurs de categories, labels, limite projets gratuits
- **Consommateurs** : `page.tsx` (home), `ProfileClient`, `ProjetClient`, `RechercheClient`, `RejoindreClient`, `DashboardClient`, `api/dashboard/projects`
- **Risque si modifie** : **CRITIQUE** — utilise dans quasiment tous les fichiers

## types/database.ts

- **Fichier** : `src/types/database.ts`
- **Role** : Source unique de verite pour tous les types TypeScript et le schema Supabase
- **Consommateurs** : Tous les fichiers du projet
- **Risque si modifie** : **CRITIQUE** — casse potentiellement tout le typage de l'app
