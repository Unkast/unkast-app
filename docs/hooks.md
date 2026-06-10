# Unkast — Hooks

## Hooks custom

Aucun hook custom n'existe dans le projet. Il n'y a pas de repertoire `src/hooks/`.

Tout le state est gere en local via `useState` dans chaque Client Component.

## Hooks utilises (built-in / frameworks)

| Hook | Fichier | Usage |
|---|---|---|
| `useState` | Tous les Client Components | State local (filtres, modales, formulaires) |
| `useEffect` | `AppShell`, `SplashScreen`, `HeroPlayer`, `VideoEmbed`, `FadeInView` | Side effects (mount detection, observers, indicateur position) |
| `useRef` | `AppShell`, `FadeInView` | Refs DOM (nav, intersection observer) |
| `usePathname` | `AppShell` | Detection de la route active pour navigation |
| `useRouter` | `DashboardClient` | Redirect programmatique vers /rejoindre |

## Observations

- Le pattern recurrent est `useState(false)` + `useEffect(() => setMounted(true), [])` pour le guard SSR (dans `HeroPlayer`, `VideoEmbed`)
- `DashboardClient` concentre le plus de state local (~15 variables useState)
- Aucun state management global (pas de Zustand, Redux, Context)
