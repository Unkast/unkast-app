# Unkast — Capacitor et Android

> Créé le 10/10/2026 (lot 11). Décision d'origine : [ADR 0011](adr/0011-mobile-en-wrapper-capacitor.md).
> Ce fichier ne décrit que ce qui a été vérifié dans le code à cette date.

## Principe

L'app Android est une coque Capacitor 8 autour du site en production : `capacitor.config.ts` pointe `server.url` sur `https://app.unkast.com`. Aucun bundle web n'est embarqué, toute livraison Vercel atteint l'app sans reconstruire l'APK. L'APK n'est à reconstruire que lorsqu'un plugin natif ou la configuration Capacitor change.

- Identifiant : `com.unkast.app` (`capacitor.config.ts`, `android/app/build.gradle`).
- `MainActivity` : `BridgeActivity` nue (`android/app/src/main/java/com/unkast/app/MainActivity.java`).
- Fichiers générés par `npx cap sync android` : `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`.
- L'APK est construit par Maxime, jamais par l'agent.

## Plugins natifs

| Plugin | Usage | Appelant |
|---|---|---|
| `@capacitor/app` | cycle de vie, bouton retour | `AppShell` |
| `@capacitor/camera` | photo de profil | `AvatarUpload` |
| `@capacitor/push-notifications` (FCM, `google-services.json`) | notifications | `usePushNotifications` |
| `@capacitor/share` | partage natif | `ShareButton` |
| `@capacitor/status-bar` | barre d'état transparente par-dessus la page, icônes claires | configuration, `AppShell` |
| `SystemBars` (cœur de Capacitor 8, rien à installer) | style des deux barres (état et navigation), marges de zone sûre | configuration, `AppShell` |
| `@capgo/capacitor-social-login` | connexion Google native (lot 11) | `GoogleSignInButton` |

Règle commune : le code web charge un plugin par import dynamique et teste `Capacitor.isNativePlatform()`, de sorte que le même code tourne dans un navigateur.

## Connexion Google native (lot 11, [ADR 0016](adr/0016-connexion-google-par-jeton.md))

- `GoogleSignInButton` appelle `SocialLogin.initialize({ google: { webClientId } })` puis `SocialLogin.login({ provider: "google", options: { nonce } })`. Le sélecteur de comptes Android (Credential Manager) rend un jeton d'identité, passé à `supabase.auth.signInWithIdToken`.
- `webClientId` est l'identifiant du client **Web** (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`), jamais celui du client Android. Le client Android n'existe que dans Google Cloud : il autorise le couple package + empreinte SHA-1 de signature.
- Un client Android par empreinte : keystore de debug, keystore de release, et clé de signature Play si l'app passe par le Play Store.
- Seul Google est embarqué : `plugins.SocialLogin.providers` dans `capacitor.config.ts` (Facebook, Apple et Twitter à `false`). Cette configuration est écrite par `npx cap sync android` dans `node_modules/@capgo/capacitor-social-login/android/gradle.properties` : relancer la synchronisation après un `npm install`, avant de construire l'APK.
- Aucun intent-filter, aucune modification de `MainActivity` ni du manifeste.
- Diagnostic d'un échec : Logcat filtré sur `GoogleProvider`. Le plugin y écrit le package, l'empreinte de signature et l'identifiant client utilisés, à comparer avec Google Cloud.
- Un APK construit avant le lot 11 n'a pas le plugin : `Capacitor.isPluginAvailable("SocialLogin")` est faux et le bouton Google n'est pas affiché.

## Barres système et zone sûre (10/10/2026)

- `targetSdkVersion` 36 : sur Android 15 et plus, le bord à bord est imposé, sans dérogation possible. La page occupe tout l'écran, barre d'état et barre de navigation posées par-dessus, transparentes.
- Le site déclare `viewport-fit=cover` (`src/app/layout.tsx`). Avec ce réglage, le plugin `SystemBars` (`insetsHandling: "css"`) laisse la page passer sous les barres et renseigne `env(safe-area-inset-*)` (WebView 140 et plus). Sur une WebView plus ancienne, il décale la page lui-même et ces valeurs valent 0.
- Règle : tout élément collé en haut ou en bas de l'écran ajoute `env(safe-area-inset-top, 0px)` ou `env(safe-area-inset-bottom, 0px)` à sa marge. Dans un navigateur ces valeurs valent 0 : rien ne change.
- Éléments couverts : en-tête, barre d'onglets, dock et pilule « vue admin » d'`AppShell`, en-tête et message de l'espace admin (hors `AppShell`), conversation, assistant de recherche (haut et bas), `Toast`, messages flottants de `ProjetClient` et `DashboardClient`, lecteur plein écran de `ProjetClient`, recadrages plein écran (`AvatarUpload`, `PosterUpload`), feuilles basses (`RoleSelector`, `AvatarUpload`, `PosterUpload`), bandeaux flottants (`ConversionBanner`, `RecruitmentSpace`).
- Style : `capacitor.config.ts` (`StatusBar.overlaysWebView`, `StatusBar.style` et `SystemBars.style` à `DARK` = icônes claires) au lancement, puis `AppShell` au montage (`StatusBar.setOverlaysWebView`, `StatusBar.setStyle`, `SystemBars.setStyle`). L'app n'a qu'un thème sombre ; un thème clair passerait `Style.Light`.
- `WelcomeClient` ne règle plus la barre d'état (il la repassait en mode non superposé en quittant l'accueil).
- Un changement de `capacitor.config.ts` demande `npx cap sync android` puis un nouvel APK. Les marges CSS et le code d'`AppShell` arrivent avec le déploiement du site.
- Non vérifié sur appareil à cette date (aucun test sur Android 15 réel ou émulé) : à contrôler après le prochain APK, y compris la navigation à 3 boutons : le voile translucide d'Android est désactivé dans `android/app/src/main/res/values/styles.xml` (`enforceNavigationBarContrast` à `false` sur les trois thèmes, Android 10 et plus).
