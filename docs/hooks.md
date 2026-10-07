# Unkast — Hooks

> Mis a jour 2026-06-13. L'ancienne note « aucun hook custom » est obsolete : `src/hooks/` existe
> et contient 2 hooks.

## Hooks custom

### `useUserStatus()` — `src/hooks/useUserStatus.ts`

Retourne le statut du visiteur : `"anonymous" | "free" | "pro" | null` (`null` = en cours de chargement).
Cree un client navigateur `@supabase/ssr` (import dynamique), lit `auth.getUser()` puis `profiles.plan`.
Renvoie `"pro"` si `plan === "pro"`, sinon `"free"` ; `"anonymous"` si non connecte ou erreur.
Sert au gating freemium cote client.

### `usePushNotifications(isLoggedIn)` — `src/hooks/usePushNotifications.ts`

Enregistre les notifications push **uniquement en natif (Capacitor/Android)**. Import dynamique de
`@capacitor/push-notifications` ; en web le `try/catch` ignore silencieusement. Demande la permission,
`register()` FCM, et au `registration` envoie le token a `POST /api/notifications/register`
(`{ token, platform: "android" }`). Gere aussi le tap de notification (redirige vers `data.url`).
Garde anti-double-enregistrement via `useRef`.

### `useKeyboardOpen()` — local a `src/components/AppShell.tsx` (non exporte)

Retourne `true` quand le clavier virtuel est suppose ouvert : focus d'un champ de texte
(`focusin` / `focusout`), affine par `visualViewport` pour detecter le clavier referme sans
quitter le champ. Sert uniquement a masquer `LiquidDock`.

## Hooks built-in / frameworks utilises

| Hook | Usage |
|---|---|
| `useState` | State local dans tous les Client Components |
| `useEffect` | Side effects (mount guard SSR, observers, polling) |
| `useRef` | Refs DOM, guards (`AppShell`, `FadeInView`, `usePushNotifications`) |
| `usePathname` | Route active (`AppShell`) |
| `useRouter` | Redirections programmatiques (`DashboardClient`, ...) |

## Observations

- Pattern recurrent : `useState(false)` + `useEffect(() => setMounted(true), [])` pour le guard SSR.
- Les deux hooks custom font de l'**import dynamique** pour ne charger le SDK Supabase/Capacitor que cote client/natif.
- Toujours **aucun state management global** (pas de Zustand/Redux/Context).
