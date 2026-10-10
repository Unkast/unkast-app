# Audit des dépendances - 2026-10-10

Périmètre : `package.json`, `package-lock.json` (lockfileVersion 3, 759 paquets), imports de `src/`, `scripts/`, `android/`, fichiers de config.
Méthode : `npm audit`, `npm audit --omit=dev`, `npm outdated`, `npm ls`, lecture du verrou, grep des imports statiques et dynamiques. Lecture seule : aucune installation, aucun build, aucun serveur lancé.

Résultat brut de `npm audit` : 41 paquets vulnérables (5 critiques, 21 élevés, 13 modérés, 2 faibles). En excluant les dépendances de développement (`--omit=dev`) : 31 (5 critiques, 13 élevés, 12 modérés, 1 faible).

Les 5 paquets notés critiques par npm : `next`, `@capacitor/android`, `protobufjs`, `websocket-driver`, `tar`. Ils sont répartis ci-dessous selon leur exposition réelle dans ce projet, pas selon la note npm seule.

---

## Critique

### C1. `next` 16.2.0 épinglé sur une version avec 31 avis de sécurité, dont 3 critiques

- Fichier : `package.json:25` (`"next": "16.2.0"`, version exacte, sans `^`). `eslint-config-next` suit en `package.json:39`.
- Constat : `npm audit` liste 31 avis sur `next` pour la plage `>=16.0.0 <16.3.8`. `npm outdated` donne Current 16.2.0, Wanted 16.2.0, Latest 16.4.0. L'épinglage exact empêche toute montée de correctif automatique.
- Avis qui touchent des fonctions utilisées par le projet :
  - Contournement du Middleware / Proxy en App Router : GHSA-26hh-7cqf-hhc6 (corrigé en 16.2.6), GHSA-267c-6grr-h53f et GHSA-492v-c6pp-mqqv (16.2.5), GHSA-6gpp-xcg3-4w24 (16.2.11). Le projet a un proxy actif : `src/proxy.ts:4` appelle `updateSession` (session et contrôle de suspension).
  - Exécution de code à distance dans l'API d'optimisation d'images avec des fichiers AVIF : GHSA-2xp9-vwfh-vxw4 (critique, corrigé en 16.3.3). AVIF est activé en `next.config.ts:27` et `next/image` est utilisé dans 6 fichiers de `src/`.
  - SSRF dans l'optimisation d'images : GHSA-cjq9-62q9-8jv4 (élevé, corrigé en 16.3.8). `next.config.ts:12` autorise `**.supabase.co` en joker.
  - Déni de service sur les Server Components : GHSA-q4gf-8mx6-v5v3 (16.2.3), GHSA-8h8q-6873-q5fj (16.2.5).
  - `next` embarque aussi ses propres `sharp` 0.34.5 et `postcss` 8.4.31 (`node_modules/next/node_modules/`), tous deux vulnérables (élevé). `npm audit` indique que seule la montée de `next` en 16.4.0 les corrige.
- Avis qui ne semblent pas s'appliquer (vérifié par grep) : RCE `next/og` ImageResponse GHSA-vcvr-r3jv-pc5j (aucun import de `next/og` ni fichier `opengraph-image` dans `src/`), Server Actions (aucune directive `"use server"` dans `src/`), Pages Router i18n (pas de dossier `pages/`), RCE sur serveur Windows GHSA-p293-qw3h-jr36 (ne concerne que l'hébergement, pas le poste de dev ; la prod est sur Vercel).
- Risque concret : le site public `app.unkast.com` tourne sur une version dont le contournement du proxy et plusieurs dénis de service sont publics. L'impact réel du contournement dépend de ce que le proxy est seul à protéger (voir Non vérifié). Les routes d'API s'authentifient elles-mêmes d'après le commentaire `src/proxy.ts:8-15`.
- Correction proposée : passer `next` et `eslint-config-next` à 16.4.0 (`npm audit` annonce `isSemVerMajor: false`). Lire d'abord les notes de version dans `node_modules/next/dist/docs/` après installation (consigne AGENTS.md), tester en local, puis déployer.

### C2. `@capacitor/android` 8.3.0 : avis critique sur le chargement de contenu distant à l'origine de l'app

- Fichier : `package.json:13` (`"@capacitor/android": "^8.3.0"`, installé 8.3.0). Même version pour `@capacitor/core` (`package.json:17`) et `@capacitor/cli` (`package.json:16`).
- Constat : `npm audit` signale GHSA-rvm3-566m-v7fv, gravité critique, plage `8.0.0 - 8.3.4` : « remote content can be loaded at the app origin via the internal HTTP proxy path ». `npm outdated` : Wanted et Latest 8.5.3, donc correctif dans la plage `^8.3.0`.
- Pourquoi l'APK est concerné : `android/capacitor.settings.gradle:3` compile la bibliothèque depuis `../node_modules/@capacitor/android/capacitor`. La version embarquée dans l'APK est donc celle installée localement, 8.3.0.
- Contexte aggravant, à traiter dans l'audit sécurité : `capacitor.config.ts:8` charge une URL distante (`server.url`) et `capacitor.config.ts:11` active `allowMixedContent: true`.
- Risque concret : un contenu tiers pourrait être servi comme s'il venait de l'origine de l'app, avec accès au pont natif (caméra, notifications, jeton de session). Les conditions exactes d'exploitation n'ont pas été vérifiées (voir Non vérifié) : la gravité retenue est celle de l'avis.
- Correction proposée : monter ensemble `@capacitor/android`, `@capacitor/core` et `@capacitor/cli` en 8.5.3 (les trois doivent rester alignés), puis `cap sync` et reconstruction de l'APK par Maxime. Un rebuild APK est nécessaire pour que le correctif arrive sur les téléphones : la mise à jour du site seul ne suffit pas.

---

## Important

### I1. `firebase-admin` 13.7.0 tire une chaîne transitive vulnérable (2 critiques, 5 élevés)

- Fichier : `package.json:23`. Importé par `src/lib/firebase-admin.ts:2`, utilisé uniquement pour `admin.messaging()` en `src/lib/push.ts:22`.
- Constat (`npm audit` et `npm ls`) :
  - `protobufjs` 7.5.4, critique (exécution de code arbitraire GHSA-xq3m-2v4x-88gg, plus 11 autres avis), chemin `firebase-admin > @google-cloud/firestore > google-gax > protobufjs`.
  - `websocket-driver` 0.7.4, critique (GHSA-xv26-6w52-cph6), chemin `firebase-admin > @firebase/database-compat > @firebase/database > faye-websocket`.
  - `@grpc/grpc-js` 1.14.3 (élevé), `node-forge` 1.4.0 (élevé, vérification de signature RSA), `@fastify/busboy` 3.2.0 (élevé), `form-data` 2.5.5 (élevé), `uuid` en 5 exemplaires (modéré).
  - `npm audit` indique `fix available via npm audit fix` sans rupture pour toute cette chaîne.
- Risque concret : limité aujourd'hui, car les chemins vulnérables passent par Firestore, Storage et Realtime Database, que le code n'appelle pas (seul `messaging` est utilisé, vérifié par grep de `admin.(firestore|storage|database|auth)(` : aucun résultat). Le risque devient réel dès qu'un de ces modules est utilisé. `node-forge` et `google-auth-library` sont en revanche sur le chemin d'authentification du compte de service.
- Correction proposée : `npm audit fix` (sans `--force`) pour remonter les transitives, et `firebase-admin` vers 13.10.0 (Wanted d'après `npm outdated`). Vérifier ensuite l'envoi d'une notification push en local.

### I2. `@supabase/supabase-js` 2.99.2 embarque `ws` 8.19.0 vulnérable, et 18 versions mineures de retard

- Fichier : `package.json:22`. Importé dans `src/lib/supabase/admin.ts:2`, `src/lib/project-edit.ts:2`, `src/lib/messaging.ts:1` et autres.
- Constat : `npm audit` signale `ws` plage `8.0.0 - 8.20.1`, élevé (épuisement mémoire GHSA-96hv-2xvq-fx4p, fuite de mémoire non initialisée GHSA-58qx-3vcg-4xpx), chemin `@supabase/supabase-js > @supabase/realtime-js > ws`. `npm outdated` : Current 2.99.2, Wanted 2.117.3.
- Risque concret : `ws` n'est utilisé que côté Node. Le seul canal temps réel trouvé est côté navigateur (`src/app/(app)/messages/[id]/page.tsx:113`), qui utilise le WebSocket natif. L'exposition serveur paraît donc faible, mais le client Supabase porte toute l'authentification et l'accès aux données : rester 18 mineures en arrière prive des correctifs.
- Correction proposée : monter `@supabase/supabase-js` en 2.117.3 (dans la plage `^2.99.2`), tester connexion, messagerie temps réel et routes d'API.

---

## Mineur

### M1. `@capacitor/cli` rangé en dépendance de production, avec `tar` critique et `@xmldom/xmldom` élevé

- Fichier : `package.json:16`. Seul usage dans le code : un import de type en `capacitor.config.ts:1`. C'est un outil de ligne de commande.
- Constat : il amène `tar` 7.5.13 (critique, GHSA-23hp-3jrh-7fpw et 5 autres) et `@xmldom/xmldom` 0.8.12 (élevé, 14 avis) dans l'arbre de production. Vercel l'installe pour rien.
- Risque : faible, l'outil ne tourne que sur le poste de Maxime et ne traite pas d'archives venant de tiers. Il gonfle le résultat de `npm audit --omit=dev`.
- Correction proposée : le déplacer en `devDependencies` et le monter en 8.5.3 avec C2.

### M2. Ne jamais lancer `npm audit fix --force` : il rétrograderait `eslint-config-next` en 14.2.35

- Fichier : `package.json:39`.
- Constat : pour la chaîne `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces` (élevé, GHSA-vfj7-8cjw-p6xm), `npm audit` ne propose que `npm audit fix --force`, qui installe `eslint-config-next@14.2.35` (rupture majeure, incompatible avec Next 16). Autres avis côté outillage, corrigeables sans rupture : `js-yaml` 4.1.1, `brace-expansion`, `picomatch`, `browserslist`, `@babel/core`, `@humanfs/node`, `baseline-browser-mapping`, `source-map-js`, `nanoid` 3.3.11 (via `postcss`).
- Risque : nul en production (lint uniquement). Le risque est de casser le lint en appliquant `--force`.
- Correction proposée : `npm audit fix` simple. Accepter le reliquat `braces` tant qu'aucun correctif amont n'existe.

### M3. `resend` 6.9.4 : avis modéré via `svix > uuid`

- Fichier : `package.json:30`. Importé par `src/lib/email.ts:2`.
- Constat : `npm audit` plage `6.2.0-canary.0 - 6.12.2` (modéré, `uuid` GHSA-w5hq-g745-h8pq). `npm outdated` : Wanted 6.32.1.
- Correction proposée : monter en 6.32.1 (dans la plage), tester un envoi d'email.

### M4. `sharp` 0.35.1 : avis élevés sur libheif et librsvg

- Fichier : `package.json:40`. Seul usage : `scripts/optimize-category-images.mjs:12`.
- Constat : `npm audit` plage `<=0.35.5-rc.1` (GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w). Wanted 0.35.5.
- Risque : faible, le script ne traite que les images du dépôt. La copie de `sharp` embarquée par Next (0.34.5) est traitée en C1.
- Correction proposée : monter en 0.35.5.

### M5. Sept dépendances en retard d'au moins une version majeure

D'après `npm outdated` (colonnes Current puis Latest) :

| Paquet | Ligne | Current | Latest | Fichiers à revoir |
|---|---|---|---|---|
| `stripe` | `package.json:31` | 22.2.1 | 23.0.0 | `src/lib/stripe.ts:2`, `src/app/api/billing/webhook/route.ts:5` |
| `firebase-admin` | `package.json:23` | 13.7.0 | 14.5.0 | `src/lib/firebase-admin.ts:2`, `src/lib/push.ts:22` |
| `framer-motion` | `package.json:24` | 12.38.0 | 14.1.0 | 16 fichiers de `src/`, `next.config.ts:32` |
| `react-easy-crop` | `package.json:28` | 5.5.7 | 6.2.4 | `src/components/AvatarUpload.tsx:5`, `src/app/(app)/moi/PosterUpload.tsx:7` |
| `eslint` | `package.json:38` | 9.39.4 | 10.12.0 | `eslint.config.mjs:1` |
| `typescript` | `package.json:42` | 5.9.3 | 7.0.2 | tout le projet |
| `@types/node` | `package.json:35` | 20.19.37 | 26.6.5 | voir M10 |

- Ce que chaque montée casserait n'a pas été vérifié (pas de lecture des notes de version, voir Non vérifié). Point connu par le code : `src/lib/stripe.ts:16` omet volontairement `apiVersion`, donc une montée majeure du SDK Stripe peut changer les types sans changer la version d'API du compte.
- Correction proposée : aucune urgence. Traiter une majeure à la fois, après C1, C2, I1, I2.

### M6. `@supabase/ssr` 0.9.0 bloqué par sa plage

- Fichier : `package.json:21` (`^0.9.0`). `npm outdated` : Wanted 0.9.0, Latest 0.12.7.
- Constat : en version 0.x, `^0.9.0` n'accepte que les 0.9.x. Trois mineures de retard sur la bibliothèque qui gère les cookies de session (`src/lib/supabase/server.ts:1`, `src/lib/supabase/middleware.ts:1`, `src/lib/supabase/client.ts:1`).
- Correction proposée : monter à la main vers 0.12.x après lecture des notes de version, avec test complet de connexion, déconnexion et rafraîchissement de session.

### M7. `server-only` importé sans être déclaré

- Fichiers : `src/lib/adminGuard.ts:1`, `src/lib/email.ts:1`, `src/lib/auth-guard.ts:1`, `src/lib/firebase-admin.ts:1`, `src/lib/project-edit.ts:1`, `src/lib/stripe.ts:1`, `src/lib/supabase/admin.ts:1`.
- Constat vérifié : `server-only` est absent de `package.json`, `npm ls server-only` renvoie `(empty)` et `node_modules/server-only` n'existe pas. Next en fournit une copie interne dans `node_modules/next/dist/compiled/server-only/`.
- Risque : aucun dans un build Next, qui résout ce module lui-même (comportement non reproduit ici, pas de build lancé). En dehors du bundler Next (script Node, futur lanceur de tests), l'import échouerait avec « Cannot find module ».
- Correction proposée : rien à faire aujourd'hui. Déclarer `server-only` en dépendance le jour où ces fichiers sont exécutés hors de Next (tests).

### M8. `optimizeCss` activé sans le paquet `critters`

- Fichier : `next.config.ts:31`.
- Constat : `node_modules/next/dist/server/post-process.js:16` fait `require('critters')` quand `optimizeCss` est actif. `critters` (et `beasties`) sont absents de `package.json` et de `node_modules`. Ce chemin de code appartient au rendu Pages Router (`render.js`), et le projet n'a pas de dossier `pages/`.
- Risque : soit l'option est sans effet (le plus probable), soit elle provoque une erreur le jour où une page passe par ce chemin. Non reproduit, pas de build lancé.
- Correction proposée : retirer l'option si elle n'apporte rien, ou installer le paquet attendu. À trancher après un build de contrôle.

### M9. `react-player` 3 : arbre lourd pour deux fournisseurs seulement

- Fichier : `package.json:29`. Seul import : `src/components/VideoEmbed.tsx:9` (dynamique, `ssr: false`).
- Constat : le paquet amène dans `node_modules` `hls.js` (24 Mo), `@mux/*` (23 Mo), `media-chrome` en deux versions (4.17.2 et 4.16.1, 5,6 Mo). Le projet ne lit que YouTube et Vimeo (`src/components/VideoEmbed.tsx:14-23`).
- Risque : poids d'installation, et peut-être poids du chunk chargé au clic. Le poids réellement envoyé au navigateur n'a pas été mesuré (pas de build).
- Correction proposée : mesurer le chunk après un build. Si lourd, une iframe YouTube / Vimeo native suffirait. Décision produit, à valider par Maxime.

### M10. `@types/node` en 20 alors que le poste tourne en Node 24, sans version de Node déclarée

- Fichier : `package.json:35` (`^20`). `node -v` local : v24.16.0. Pas de champ `engines` dans `package.json`, pas de `.nvmrc` ni `.node-version`.
- Risque : types en décalage avec l'exécution, et version de Node de Vercel non fixée par le dépôt.
- Correction proposée : déclarer `engines.node` avec la version utilisée sur Vercel et aligner `@types/node` dessus.

### M11. `firebase-admin` installe Firestore et Storage pour un seul usage (push)

- Fichier : `package.json:23`. Usage : `src/lib/push.ts:22` uniquement.
- Constat : `@google-cloud/firestore` et `@google-cloud/storage` sont des dépendances optionnelles de `firebase-admin` (8,9 Mo dans `node_modules/@google-cloud`) et portent la majorité des avis de I1.
- Correction proposée : aucune action immédiate. Si la surface d'avis gêne, l'API HTTP v1 de FCM avec `google-auth-library` couvrirait le besoin. À évaluer, pas à faire d'office.

### M12. Doublons dans le verrou (tous transitifs)

- Fichier : `package-lock.json`.
- Constat : `uuid` en 4 versions sur 6 copies (8.3.2, 9.0.1, 10.0.0, 11.1.0), `google-auth-library` 9.15.1 et 10.6.2, `gaxios` 6.7.1 et 7.1.4, `gcp-metadata` 6.1.1 et 8.1.2, `node-fetch` 2.7.0 et 3.3.2 (toute cette série vient de `firebase-admin`), `sharp` 0.34.5 (dans `next`) et 0.35.1, `postcss` 8.4.31 (dans `next`) et 8.5.8, `media-chrome` 4.16.1 et 4.17.2 (via `react-player`), `semver` 6.3.1, 7.7.4, 7.8.4.
- Risque : poids d'installation uniquement. Aucun doublon sur `react`, `react-dom`, `next` ou `@supabase/*`.
- Correction proposée : rien de direct. I1 et C1 en résorbent une partie.

### M13. Un paquet déprécié : `node-domexception` 1.0.0

- Fichier : `package-lock.json` (entrée `node_modules/node-domexception`), chemin `firebase-admin > google-auth-library > gaxios > node-fetch > fetch-blob`.
- Constat : seul paquet marqué `deprecated` dans le verrou (« Use your platform's native DOMException instead »).
- Correction proposée : aucune, se résorbera avec les montées de `firebase-admin`.

### M14. La documentation dit que `resend` n'est pas connecté, le code l'utilise

- Fichiers : `CLAUDE.md:14` et `docs/architecture.md:16` (« installe, pas encore connecte »). Code : `src/lib/email.ts:2`, appelé depuis `src/app/api/admin/route.ts:2`, `src/app/api/auth/resend-confirmation/route.ts:4`, `src/app/api/cron/pro-expiry/route.ts:4`, `src/app/api/dashboard/projects/route.ts:20`.
- Correction proposée : corriger les deux lignes de doc (sur demande explicite, la doc n'est pas modifiée par cet audit).

---

## Points vérifiés sans défaut

- Dépendances inutilisées : aucune. Chaque paquet déclaré a au moins un usage (imports statiques, `await import()`, config, `android/`) :
  - `@capacitor/app` `src/components/AppShell.tsx:420`, `@capacitor/status-bar` `src/components/AppShell.tsx:463` et `src/app/WelcomeClient.tsx:18`, `@capacitor/camera` `src/components/AvatarUpload.tsx:36`, `@capacitor/push-notifications` `src/hooks/usePushNotifications.ts:33`, `@capacitor/core` `src/components/ShareButton.tsx:36`, `@capacitor/share` `src/components/ShareButton.tsx:38` (tous en import dynamique).
  - `@capacitor/android` : aucun import JS, utilisé par Gradle (`android/capacitor.settings.gradle:3`).
  - `@tailwindcss/postcss` `postcss.config.mjs:3`, `eslint-config-next` `eslint.config.mjs:2`, `sharp` `scripts/optimize-category-images.mjs:12`, `stripe` `src/lib/stripe.ts:2`, `react-player` `src/components/VideoEmbed.tsx:9`.
- peerDependencies : toutes satisfaites (contrôle de chaque `peerDependencies` du verrou contre la version installée). `npm ls --all` ne signale que des dépendances optionnelles de plateforme (binaires `lightningcss`, `@tailwindcss/oxide`, `@unrs/resolver` pour d'autres systèmes), ce qui est normal.
- Registre : tous les paquets du verrou viennent de `https://registry.npmjs.org/`. Aucune adresse git, aucun chemin local, aucun lien.
- Verrou : `package-lock.json` est suivi par git et cohérent avec `package.json`.
- `@capacitor/share` (`package.json:19`) : pas encore synchronisé côté Android. Il est absent de `android/capacitor.settings.gradle`, de `android/app/capacitor.build.gradle` et de `android/app/src/main/assets/capacitor.plugins.json`. C'est voulu d'après le contexte de l'audit, ce n'est pas un défaut. À retenir : le partage natif ne fonctionnera dans l'app qu'après `cap sync` et un rebuild de l'APK.

---

## Non vérifié

- Conditions d'exploitation de GHSA-rvm3-566m-v7fv (C2) dans cette app précise : l'avis n'a pas été lu en détail (pas d'accès web utilisé), aucun test sur appareil.
- Ce que Vercel atténue pour les avis Next (C1) : plusieurs avis visent l'auto-hébergement ou l'optimiseur d'images de Next, que Vercel peut remplacer par le sien. Non vérifiable depuis le dépôt.
- Ce que le proxy est seul à protéger (C1) : `src/lib/supabase/middleware.ts` n'a pas été audité ici. Voir `docs/audits/2026-10-09-securite.md`.
- Ruptures concrètes des montées majeures (M5, M6) : notes de version non consultées. La liste des fichiers à revoir vient des imports, pas des changelogs.
- Poids réel dans le bundle navigateur de `react-player` et `framer-motion` (M9) : aucun build lancé, consigne de l'audit.
- Résolution de `server-only` (M7) et effet réel de `optimizeCss` (M8) pendant un build : aucun build lancé.
- Paquets abandonnés au sens « aucune publication depuis longtemps » : seules les marques `deprecated` du verrou ont été contrôlées. Les dates de publication n'ont pas été interrogées.
- Dépendances natives Android hors npm (`android/app/build.gradle:43` `firebase-bom:32.7.0`, `android/build.gradle:11` `google-services:4.4.4`) : hors de portée de `npm audit` et `npm outdated`.
- Version de Node utilisée par Vercel (M10) : réglage du projet Vercel, absent du dépôt.

---

## Résumé chiffré

| Gravité | Nombre |
|---|---|
| Critique | 2 |
| Important | 2 |
| Mineur | 14 |
| Total | 18 |

Ordre de traitement conseillé : C1 (Next 16.4.0), C2 (Capacitor 8.5.3 puis rebuild APK), puis `npm audit fix` sans `--force` qui couvre I1, I2, M3, M4 et l'essentiel de M2.
