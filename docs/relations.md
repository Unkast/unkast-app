# Unkast — Relations

## Table des relations

| Source | Type de relation | Destination |
|--------|-----------------|-------------|
| `layout.tsx` | [utilise] | `AppShell` |
| `layout.tsx` | [utilise] | `SplashScreen` |
| `layout.tsx` | [utilise] | `globals.css` |
| `AppShell` | [depend de] | `next/navigation` (usePathname) |
| `AppShell` | [utilise] | `framer-motion` |
| `SplashScreen` | [depend de] | `/public/splash.mp4` |
| `SplashScreen` | [depend de] | `sessionStorage` |
| `middleware.ts` | [utilise] | `supabase/middleware.ts` |
| `supabase/middleware.ts` | [utilise] | `@supabase/ssr` |
| `supabase/server.ts` | [utilise] | `@supabase/ssr` |
| `supabase/server.ts` | [depend de] | `next/headers` (cookies) |
| `supabase/client.ts` | [utilise] | `@supabase/ssr` |
| `constants.ts` | [utilise] | `types/database.ts` (ProjectCategory) |
| `motion.tsx` | [utilise] | `framer-motion` |
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
| `HeroCarousel` | [utilise] | `constants.ts` (CATEGORY_LABELS) |
| `HomeAnimations` | [utilise] | `framer-motion` |
| `HomeAnimations` | [utilise] | `motion.tsx` (FadeInView) |
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
| `ProfileClient` | [utilise] | `motion.tsx` (FadeInView, cardHover) |
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
| `ProjetClient` | [utilise] | `motion.tsx` (FadeInView) |
| --- | --- | --- |
| **Recherche** | | |
| `RechercheClient` | [declenche] | `GET /api/search` |
| `RechercheClient` | [utilise] | `constants.ts` |
| `RechercheClient` | [utilise] | `framer-motion` |
| `GET /api/search` | [persiste dans] | `profiles` (lecture) |
| `GET /api/search` | [persiste dans] | `profile_roles` (lecture) |
| `GET /api/search` | [persiste dans] | `projects` (lecture) |
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

## Relations base de donnees

| Table source | FK | Table cible | ON DELETE |
|---|---|---|---|
| `profiles.id` | → | `auth.users.id` | CASCADE |
| `profile_roles.profile_id` | → | `profiles.id` | CASCADE |
| `projects.profile_id` | → | `profiles.id` | CASCADE |
| `project_credits.project_id` | → | `projects.id` | CASCADE |
| `project_credits.profile_id` | → | `profiles.id` | SET NULL |
| `contact_requests.to_profile_id` | → | `profiles.id` | CASCADE |
