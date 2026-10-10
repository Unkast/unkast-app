# Audit de la performance front

Date : 10/10/2026
Périmètre : `src/app`, `src/components`, `src/hooks`, `src/lib` (côté affichage), `next.config.ts`, `public/`, et les routes d'API appelées au chargement des écrans.
Mode : lecture seule. Aucune correction appliquée, aucun serveur lancé, aucun build lancé.

## Méthode et limites des chiffres

- **Mesuré** : les tailles de JavaScript viennent du build de production déjà présent dans `.next/` (BUILD_ID `jkIcsXWP5BBqRJ2JipgyA`, 10/10/2026 12:13), lues dans `.next/diagnostics/route-bundle-stats.json` et `.next/static/chunks`. Les tailles « gzip » sont calculées localement sur ces fichiers (zlib, niveau par défaut). Vercel sert en Brotli : les tailles réellement transférées sont un peu plus faibles.
- **Mesuré** : le caractère statique ou dynamique d'une page vient de `.next/prerender-manifest.json`.
- **Compté dans le code** : les nombres de requêtes sont ceux écrits dans le code, pas ceux observés sur le réseau.
- **Estimé** : tout ce qui touche au temps (chargement, fluidité, autonomie) est une estimation, signalée comme telle. Rien n'a été mesuré dans un navigateur ni sur téléphone.
- L'impact estimé de chaque constat (faible, moyen, élevé) est un jugement sur le code, pas une mesure.

## Vue d'ensemble

Chiffres mesurés sur le build :

| Page | JS au premier chargement (brut) | gzip | Fichiers |
|---|---|---|---|
| `/moi` | 1 083 966 o | 314 303 o | 15 |
| `/projet/[slug]` | 984 496 o | 288 333 o | 14 |
| `/profil/[slug]` | 980 923 o | 286 472 o | 13 |
| `/recherche` | 952 660 o | 278 876 o | 13 |
| `/feed` | 949 101 o | 278 338 o | 13 |
| `/messages` | 912 806 o | 266 095 o | 12 |
| `/` (accueil) | 750 312 o | 212 872 o | 10 |
| `/admin` | 594 657 o | 171 554 o | 12 |
| Socle commun (React, Next, routeur) | 513 922 o | 146 828 o | 8 |

Sur `/feed`, ce qui s'ajoute au socle (435 Ko bruts, 131 Ko gzip) se répartit ainsi : client Supabase 186 346 o (48 825 gzip), framer-motion 134 055 o (44 113 gzip), AppShell 66 311 o (21 827 gzip), `lib/constants` 29 687 o (10 619 gzip), code propre au feed 18 780 o (6 126 gzip).

Autres mesures : CSS unique de 105 198 o (17 754 gzip). Polices : 2 fichiers préchargés (DM Sans latin 36 980 o, JetBrains Mono latin 31 340 o).

Points sains constatés :

- Le lecteur vidéo est bien hors du chargement initial. `react-player` est chargé à la demande (`src/components/VideoEmbed.tsx` ligne 9) et monté seulement au clic (`src/components/VideoFacade.tsx` ligne 22). Ses trois plus gros morceaux (954 727 o, 509 187 o, 507 751 o : lecteurs DASH, HLS et Mux) n'apparaissent dans le premier chargement d'aucune page (mesuré).
- L'assistant de recherche est chargé à sa première ouverture (`src/components/AppShell.tsx` ligne 21).
- Le layout résout le compte côté serveur en un seul `Promise.all` de 4 requêtes (`src/app/(app)/layout.tsx` ligne 38). D'après la documentation de Next 16 (`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` ligne 43), un layout n'est pas rendu à nouveau lors d'une navigation entre pages : ces 4 requêtes partent au premier chargement et à chaque `router.refresh()`, pas à chaque changement de page.
- `createBrowserClient` est appelé à chaque rendu d'AppShell (ligne 327) mais renvoie la même instance dans le navigateur (singleton de `@supabase/ssr`, vérifié dans `node_modules/@supabase/ssr/dist/main/createBrowserClient.js` ligne 11).
- Les affiches passent par `next/image` avec un attribut `sizes` adapté (`src/components/FilmPoster.tsx` ligne 60, `src/app/(app)/feed/FilmRow.tsx` ligne 93).
- Le sondage des messages non lus ne provoque pas de rendu quand le compteur ne change pas (même valeur d'état).
- Les listes ont des `key` stables (identifiants), sauf trois cas sans conséquence (M16).
- Les effets lus dans les fichiers du périmètre ont tous un tableau de dépendances.
- `SplashScreen` n'est importé nulle part : `public/splash.mp4` (60 081 o) n'est jamais téléchargé.
- La piste « requêtes en cascade côté client dans MoiClient » n'est pas confirmée telle quelle : les 4 appels partent en parallèle (`src/app/(app)/moi/MoiClient.tsx` ligne 207). Ce qui reste vrai est décrit en M6.

---

## Critique

Aucun constat. L'échelle du skill réserve ce niveau aux failles, fuites et pertes de données ; aucun défaut de performance relevé n'en relève.

---

## Important

### I1. Les `revalidate` déclarés ne mettent rien en cache : toutes les pages sont rendues à chaque visite

- **Où** : `src/app/(app)/feed/page.tsx` ligne 15 (`revalidate = 300`), `src/app/(app)/projet/[slug]/page.tsx` ligne 16 (120), `src/app/(app)/profil/[slug]/page.tsx` ligne 10 (60), `src/app/(app)/categories/[slug]/page.tsx` ligne 14 (300), `src/app/(app)/recherche/page.tsx` ligne 6 (3600).
- **Ce qui ne va pas** : ces pages lisent les cookies (`createClient()` dans `src/lib/supabase/server.ts` ligne 10, et `cookies()` dans `src/app/(app)/layout.tsx` ligne 29). Elles sont donc dynamiques et le `revalidate` est sans effet. Mesuré : `.next/prerender-manifest.json` ne contient que `/`, `/_not-found`, `/_global-error` et `/dev/ui`. Les commentaires « Cache 5 minutes », « Cache 1 hour » sont faux.
- **Risque concret** : chaque affichage du feed relance toutes ses requêtes. Compté dans le code pour un membre connecté : 1 lecture du compte, 5 requêtes de films en parallèle, puis 1 requête de talents (`feed/page.tsx` lignes 101 à 158), auxquelles s'ajoutent celles du proxy (`src/lib/supabase/middleware.ts` lignes 44 et 105). Le temps de réponse du serveur dépend entièrement de la base, à chaque visite, y compris pour un visiteur anonyme qui voit la même page que tous les autres.
- **Impact estimé** : élevé (temps de réponse de toutes les pages publiques).
- **Correction proposée** : décision à prendre par Maxime, deux voies. Soit mettre en cache les données identiques pour tous les visiteurs non connectés (lecture avec un client sans cookie, enveloppée dans le cache de données de Next, durée courte), et garder le rendu dynamique pour les membres. Soit assumer le rendu dynamique et retirer les `revalidate` et leurs commentaires trompeurs. Lire `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` avant de choisir.

### I2. Liste des conversations : trois requêtes par conversation, l'une après l'autre

- **Où** : `src/app/api/messages/route.ts` lignes 264 à 287.
- **Ce qui ne va pas** : la route lit toutes les conversations sans limite (`select("*")`, ligne 265), puis pour chacune lance trois requêtes enchaînées par `await` : le profil de l'autre personne (ligne 271), le dernier message (ligne 272), le nombre de non lus (ligne 274). Soit 1 + 3 x N requêtes.
- **Risque concret** : avec 20 conversations, 61 requêtes pour afficher `/messages`. Le temps d'attente de l'écran croît avec l'ancienneté du compte, et la fonction serveur tient 60 connexions HTTP vers la base.
- **Impact estimé** : élevé pour un compte actif, faible pour un compte neuf.
- **Correction proposée** : une requête pour les profils (`in` sur les identifiants), une pour les derniers messages et les non lus (vue ou fonction SQL qui agrège par conversation, à fournir en migration séparée), et une pagination de la liste.

### I3. Onglets « Mes films » et « Activité » : une requête par ligne dans `/api/dashboard/credits`

- **Où** : `src/app/api/dashboard/credits/route.ts` lignes 31 à 43, 51 à 64 et 73 à 86.
- **Ce qui ne va pas** : trois blocs exécutés l'un après l'autre. Chacun lit une liste en `select("*")` (lignes 26, 48, 69) puis fait une requête par ligne pour un nom ou un titre. Soit 3 + R + C + D requêtes (demandes reçues, crédits, demandes envoyées).
- **Risque concret** : un talent crédité sur 15 films déclenche au moins 18 requêtes à chaque ouverture de `/moi`, et à nouveau après chaque action (`MoiClient.tsx` lignes 333, 346, 352).
- **Impact estimé** : moyen.
- **Correction proposée** : faire porter le titre du film et le nom du demandeur par une jointure dans la requête de liste (ou une lecture groupée par `in`), et lancer les trois blocs en parallèle.

### I4. Conversation : tous les messages chargés et rendus, sans limite

- **Où** : `src/app/api/messages/[conversationId]/route.ts` lignes 29 à 32, `src/app/(app)/messages/[id]/page.tsx` ligne 373.
- **Ce qui ne va pas** : la route renvoie tous les messages de la conversation, toutes colonnes, sans `limit`. L'écran les rend tous d'un coup. Par ailleurs les messages sont marqués lus deux fois : par la route de lecture (ligne 35) puis par un second appel du navigateur (`page.tsx` ligne 72).
- **Risque concret** : une conversation de plusieurs centaines de messages (4 000 caractères maximum chacun) produit une réponse lourde et un long rendu à chaque ouverture, sur téléphone en premier. Un appel réseau inutile à chaque ouverture.
- **Impact estimé** : moyen aujourd'hui, élevé quand les conversations vieillissent.
- **Correction proposée** : ne charger que les 50 derniers messages, charger les précédents en remontant, ne sélectionner que les colonnes affichées, et supprimer l'un des deux marquages.

### I5. Avatars : image d'origine de 512 px servie telle quelle, sans chargement différé

- **Où** : `src/components/Avatar.tsx` ligne 60, `src/app/(app)/projet/[slug]/ProjetClient.tsx` ligne 354.
- **Ce qui ne va pas** : balise `<img>` brute, sans `loading="lazy"`, sans `decoding="async"`, sans `width` ni `height`, sans passage par l'optimiseur d'images. Le fichier envoyé est un WebP de 512 x 512 (`src/components/AvatarUpload.tsx` ligne 102), affiché entre 24 et 112 px. `Avatar` est utilisé à 21 endroits. Le conteneur ayant une taille fixe, il n'y a pas de décalage de mise en page : le défaut est le poids et le moment du chargement.
- **Risque concret** : sur le feed, jusqu'à 12 avatars de talents (rangée en bas de page) et 4 avatars d'équipe sont téléchargés dès l'ouverture, même hors écran. Sur une fiche film, un avatar par personne créditée, tous chargés d'un coup. Estimation : 20 à 50 Ko par avatar, soit plusieurs centaines de Ko évitables sur une page chargée. Ces téléchargements concurrencent l'affiche principale.
- **Impact estimé** : moyen.
- **Correction proposée** : ajouter `loading="lazy"` et `decoding="async"` dans `Avatar` (une ligne, sans effet visuel), et remplacer l'`<img>` de la ligne 354 de `ProjetClient` par `Avatar`. Dans un second temps, servir une variante de 128 px (via `next/image` avec `sizes`, ou une seconde taille générée à l'envoi). `Avatar` est un composant partagé par plus de 3 écrans : vérifier `docs/components-critiques.md` avant de le toucher.

### I6. Le client Supabase est dans le JavaScript initial de toutes les pages

- **Où** : `src/components/AppShell.tsx` ligne 8 (import) et ligne 327 (création).
- **Ce qui ne va pas** : AppShell enveloppe toutes les pages et importe `@supabase/ssr` de façon statique. Mesuré : le morceau `14ycat4e4~qy-.js` pèse 186 346 o (48 825 gzip) et figure dans le premier chargement de toutes les pages de `(app)`. AppShell ne s'en sert que pour écouter les changements de session (ligne 361) et pour la déconnexion (ligne 486).
- **Risque concret** : 49 Ko gzip à télécharger, analyser et exécuter avant que la page devienne interactive, sur chaque page, pour un visiteur anonyme comme pour un membre.
- **Impact estimé** : moyen.
- **Correction proposée** : charger le client à la demande, dans l'effet qui écoute la session et dans la déconnexion, comme le font déjà `src/hooks/useUserStatus.ts` ligne 11 et `src/app/(app)/messages/[id]/page.tsx` ligne 107. Le morceau sort alors du chemin critique. Même remarque pour `src/app/WelcomeClient.tsx` ligne 8.

### I7. framer-motion est chargé sur toutes les pages, en partie pour un simple effet d'appui

- **Où** : `src/components/ui/Button.tsx` lignes 4 à 6 et 37 à 43, `src/components/AppShell.tsx` ligne 6.
- **Ce qui ne va pas** : mesuré, le morceau `065wceh5rxzj6.js` (framer-motion) pèse 134 055 o (44 113 gzip) et figure dans le premier chargement de toutes les pages de `(app)`. L'option `optimizePackageImports: ["framer-motion"]` (`next.config.ts` ligne 31) ne réduit pas le composant `motion` lui-même. `Button` l'utilise pour une mise à l'échelle à l'appui, qu'une règle CSS fait déjà pour tous les boutons (`src/app/globals.css` lignes 153 à 159, neutralisée par `.press-spring` ligne 172). AppShell l'utilise pour l'indicateur de la barre latérale et un menu.
- **Risque concret** : 44 Ko gzip sur le chemin critique de chaque page, dont le feed et les pages publiques vues depuis un téléphone.
- **Impact estimé** : moyen.
- **Correction proposée** : deux options à arbitrer. Passer à `LazyMotion` avec le composant `m` et le jeu de fonctions réduit, chargé après le premier rendu (gain estimé, non mesuré : la moitié du poids ou plus). Ou rendre l'appui de `Button` et l'indicateur de la barre latérale en CSS, et ne garder framer-motion que dans les écrans qui en ont besoin. `Button` est un composant critique (utilisé partout).

### I8. Le mode allégé Android (`.lite`) laisse passer plusieurs flous coûteux

- **Où** : `src/app/globals.css` lignes 380 à 387 et 396 à 398 (ce que `.lite` neutralise) ; flous non couverts : `src/components/motion.tsx` ligne 102 et lignes 129 à 130, `src/components/RoleSelector.tsx` ligne 229, `src/app/(app)/moi/MoiClient.tsx` ligne 1120, `src/components/AppShell.tsx` ligne 844, `src/components/AvatarUpload.tsx` ligne 194, `src/app/(app)/profil/[slug]/ProfileClient.tsx` ligne 625, `src/app/(app)/messages/[id]/page.tsx` ligne 635, `src/app/(app)/feed/HeroCarousel.tsx` lignes 171 à 173, `src/components/FilmPoster.tsx` ligne 58, `src/components/LiquidDock.tsx` lignes 60 à 77.
- **Ce qui ne va pas** : `.lite` retire le `backdrop-filter` des classes `.glass` et `.glass-strong` et le filtre de `.film-ambient`, rien d'autre. Restent actifs sur Android :
  - les fonds de modales en `backdrop-blur-[20px]` (classe Tailwind ou style en ligne), plein écran ;
  - les animations d'entrée framer-motion qui animent `filter: blur(8px)` (variantes `enterUp`, utilisées par `Section` sur chaque rangée du feed et par `EnterItem` sur chaque ligne de liste) et le changement de film à la une ;
  - le fond flouté des affiches qui ne sont pas en 16:9 (`blur-xl`, une couche filtrée par carte) ;
  - le filtre SVG du dock de l'application installée (flou gaussien de 9 px sur la barre, recalculé pendant les 600 ms du déplacement de la bille).
- **Risque concret** : animer un filtre oblige à repeindre la zone à chaque image, là où `transform` et `opacity` ne coûtent presque rien. Sur une WebView Android de milieu de gamme, cela se traduit par des saccades à l'ouverture d'une modale, à l'arrivée des rangées pendant le défilement et au changement d'onglet. C'est précisément le cas que `.lite` voulait éviter.
- **Impact estimé** : moyen (estimé, aucune mesure d'images par seconde).
- **Correction proposée** : étendre `.lite` aux flous de fond des modales (une classe commune au lieu de valeurs répétées), fournir en `.lite` des variantes d'entrée sans `filter` (fondu et translation seuls), retirer le fond flouté des affiches en `.lite` (fond uni), et remplacer en `.lite` le filtre du dock par deux formes pleines.

### I9. Statut du membre recalculé dans le navigateur, en cascade, sur trois écrans

- **Où** : `src/hooks/useUserStatus.ts` lignes 11 à 26, utilisé par `src/app/(app)/projet/[slug]/ProjetClient.tsx` ligne 97, `src/app/(app)/profil/[slug]/ProfileClient.tsx` ligne 73 et `src/app/(app)/messages/page.tsx` ligne 270.
- **Ce qui ne va pas** : après l'hydratation, le hook enchaîne trois étapes : chargement à la demande du client Supabase, appel réseau `auth.getUser()`, puis lecture de `profiles.plan`. Le serveur connaît déjà le compte (le layout le lit, `src/app/(app)/layout.tsx` ligne 19) et les pages aussi (`projet/[slug]/page.tsx` ligne 53). Sur la fiche film s'ajoute un quatrième appel, `/api/credits/status` (`ProjetClient.tsx` ligne 123).
- **Risque concret** : les boutons qui dépendent du statut (demande de participation, contact, invitation) apparaissent après deux allers-retours réseau supplémentaires, donc en retard et avec un saut visuel. Ces appels sont refaits à chaque ouverture d'une fiche film ou d'un profil.
- **Impact estimé** : moyen.
- **Correction proposée** : faire calculer le statut (`anonymous`, `free`, `pro`) par le serveur et le passer en propriété (depuis la page, ou depuis le layout par un contexte fourni par AppShell). Le hook disparaît, ou ne sert plus que de repli.

---

## Mineur

### M1. Sondage des non lus toutes les 30 s, même pour un visiteur et même onglet masqué

- **Où** : `src/components/AppShell.tsx` lignes 378 à 380.
- **Ce qui ne va pas** : l'intervalle démarre sans condition sur `user` et sans tenir compte de `document.visibilityState`. Pour un membre, chaque appel exécute `auth.getUser()` puis un comptage (`src/app/api/messages/unread-count/route.ts` lignes 6 à 13).
- **Risque concret** : 120 appels par heure et par onglet ouvert, visiteurs anonymes compris, et autant d'exécutions de fonction côté Vercel. Réveils réseau inutiles sur téléphone.
- **Impact estimé** : moyen côté serveur, faible côté affichage (pas de rendu quand le compteur ne change pas).
- **Correction proposée** : ne démarrer l'intervalle que si un compte est connecté, le suspendre quand l'onglet est masqué, relancer une lecture au retour au premier plan. À terme, un abonnement temps réel remplacerait le sondage (décision produit).

### M2. Fiche film et profil : la fonction de lecture est appelée deux fois, et ses requêtes s'enchaînent

- **Où** : `src/app/(app)/projet/[slug]/page.tsx` lignes 243 et 276 (`getProject`), `src/app/(app)/profil/[slug]/page.tsx` lignes 212 et 238 (`getProfile`) ; enchaînement : `profil/[slug]/page.tsx` lignes 59, 78, 93, 102, 138, 150.
- **Ce qui ne va pas** : `generateMetadata` et la page appellent chacune la fonction, qui n'est pas enveloppée dans `cache()` de React. La documentation de Next (`caching-without-cache-components.md` ligne 266) recommande `cache()` pour tout accès aux données qui ne passe pas par `fetch`. Les lectures Supabase en GET passent par `fetch` et peuvent être dédoublonnées automatiquement ; les appels `rpc` sont des POST et ne le sont pas (`fetch.md` ligne 86 : GET seulement). Sur le profil, la lecture du casting (ligne 78) et celle du compte (ligne 93) attendent chacune la précédente alors qu'elles sont indépendantes.
- **Risque concret** : au minimum les appels `rpc` partent deux fois par affichage (jusqu'à 3 pour un visiteur sur une fiche film : lignes 96, 159, 232). Le temps de réponse additionne des étapes qui pourraient être parallèles.
- **Impact estimé** : moyen (à confirmer par une mesure, voir « Non vérifié »).
- **Correction proposée** : envelopper `getProject` et `getProfile` dans `cache()`, et regrouper les lectures indépendantes dans un même `Promise.all`.

### M3. Le compte est vérifié auprès du serveur d'authentification à chaque étage

- **Où** : `src/lib/supabase/middleware.ts` ligne 44, `src/app/(app)/layout.tsx` ligne 19, `src/app/(app)/feed/page.tsx` ligne 101 (et l'équivalent dans chaque page), puis chaque route d'API appelée par l'écran.
- **Ce qui ne va pas** : `auth.getUser()` fait un aller-retour vers le serveur d'authentification. Il est écrit dans le proxy, dans le layout et dans la page. Le proxy ajoute une lecture de `profiles` à chaque navigation d'un membre (ligne 105).
- **Risque concret** : un délai fixe ajouté au temps de réponse de chaque page, puis à chacune des 4 routes appelées par `/moi`.
- **Impact estimé** : faible à moyen (non mesuré ; les appels du layout et de la page peuvent être dédoublonnés, pas celui du proxy ni ceux des routes).
- **Correction proposée** : un helper serveur unique enveloppé dans `cache()` pour le layout et les pages. Étudier `getClaims()` (vérification locale du jeton) pour les lectures qui n'ont pas besoin d'une confirmation serveur. Sujet lié à la sécurité : à valider avec l'audit correspondant.

### M4. Feed : la requête des talents attend la fin des requêtes de films

- **Où** : `src/app/(app)/feed/page.tsx` lignes 105 à 121 puis 148 à 158.
- **Ce qui ne va pas** : les 5 requêtes de films partent ensemble, mais la requête des talents n'est lancée qu'après elles et après `loadFilmTeams` (ligne 126). Elle n'en dépend pas.
- **Risque concret** : un aller-retour base de plus dans le temps de réponse du feed (deux pour un visiteur, avec l'appel `rpc` de la ligne 126).
- **Impact estimé** : faible.
- **Correction proposée** : inclure la requête des talents dans le `Promise.all` de la ligne 105.

### M5. Entrée en cascade de 80 ms par ligne sur des listes sans plafond

- **Où** : `src/components/motion.tsx` lignes 121 à 124 (`listStagger`), utilisé par `src/app/(app)/moi/FilmsSection.tsx` ligne 100, `src/app/(app)/messages/page.tsx` ligne 212, `src/app/(app)/moi/RecruitmentSpace.tsx` ligne 286.
- **Ce qui ne va pas** : chaque ligne attend 80 ms de plus que la précédente, puis s'anime 450 ms avec un flou. La liste n'est pas plafonnée.
- **Risque concret** : avec 30 films (plafond annoncé du compte Pro, `MoiClient.tsx` ligne 1057), la dernière carte apparaît environ 2,4 s après la première (calculé : 30 x 80 ms), et 30 animations de filtre tournent en même temps.
- **Impact estimé** : moyen sur les longues listes, nul sur les courtes.
- **Correction proposée** : n'échelonner que les 6 à 8 premières lignes, afficher les suivantes sans délai.

### M6. `/moi` : tout l'écran est chargé d'un bloc et ses données arrivent après l'hydratation

- **Où** : `src/app/(app)/moi/MoiClient.tsx` lignes 8, 10, 13, 17 (imports) et 206 à 210 (chargement des données) ; `src/app/(app)/moi/CareerSection.tsx` ligne 32.
- **Ce qui ne va pas** : mesuré, `/moi` est la page la plus lourde (1 083 966 o bruts, 314 303 gzip, soit 36 Ko gzip de plus que le feed). Le recadrage d'avatar (`react-easy-crop`, morceau de 40 242 o), les indicatifs téléphoniques, le sélecteur de métiers et l'espace de recrutement sont chargés d'entrée alors qu'ils ne servent qu'en mode édition ou dans un onglet. Les données viennent de 4 appels lancés en parallèle après l'hydratation, plus un cinquième par `CareerSection`. Chacun refait sa propre vérification de compte.
- **Risque concret** : l'écran affiche un squelette le temps de télécharger le JavaScript puis d'attendre la plus lente des 4 routes (dont celle de I3). Les crédits et invitations sont chargés même si l'onglet « Activité » n'est jamais ouvert.
- **Impact estimé** : moyen.
- **Correction proposée** : charger à la demande `AvatarUpload`, `RecruitmentSpace` et le formulaire d'édition ; lire le profil côté serveur et le passer en propriété ; ne charger crédits et invitations qu'à l'ouverture de leur onglet.

### M7. `lib/constants` entier embarqué sur le feed pour deux tables de libellés

- **Où** : `src/app/(app)/feed/HeroCarousel.tsx` ligne 11, `src/components/FilmMeta.tsx` ligne 2.
- **Ce qui ne va pas** : ces composants client importent `CATEGORY_LABELS` et `CATEGORY_COLORS` depuis `src/lib/constants.ts` (534 lignes), qui contient aussi toutes les listes de métiers. Mesuré : le morceau `0o_rmkbhxzum..js` (29 687 o, 10 619 gzip) est dans le premier chargement de `/feed` et contient les listes de métiers.
- **Risque concret** : 10 Ko gzip inutiles sur la page la plus visitée.
- **Impact estimé** : faible.
- **Correction proposée** : sortir les libellés et couleurs de catégories dans un petit module à part, importé par les composants d'affichage.

### M8. `select("*")` sur des lectures renvoyées au navigateur

- **Où** : `src/app/api/dashboard/projects/route.ts` lignes 96 et 108, `src/app/api/dashboard/credits/route.ts` lignes 26, 48, 69, `src/app/api/messages/[conversationId]/route.ts` ligne 30, `src/app/api/invitations/project/route.ts` lignes 83 et 93, `src/app/api/dashboard/career/route.ts` ligne 92, `src/app/(app)/projet/[slug]/page.tsx` lignes 57, 114 et 192.
- **Ce qui ne va pas** : toutes les colonnes sont lues et sérialisées, y compris celles que l'écran n'affiche pas. Sur la fiche film, les films liés (ligne 192) partent entiers dans les propriétés du composant client.
- **Risque concret** : réponses et charge utile de page plus lourdes que nécessaire ; toute colonne ajoutée plus tard part au navigateur sans qu'on l'ait décidé.
- **Impact estimé** : faible.
- **Correction proposée** : lister les colonnes affichées, comme le fait déjà le feed (`feed/page.tsx` ligne 68).

### M9. 114 Mo d'images PNG dans `public/`, embarquées dans l'APK

- **Où** : `public/thumbnails/` (12 fichiers PNG de 6,9 à 10,5 Mo, 105 Mo au total), `public/welcome-bg.png` (8 503 837 o, 1536 x 2752), `capacitor.config.ts` ligne 6 (`webDir: "public"`), `src/app/WelcomeClient.tsx` lignes 69 à 75.
- **Ce qui ne va pas** : aucun fichier de `src/`, `scripts/` ou `supabase/` ne référence `thumbnails/`. Ces images sont suivies par git et déployées. Comme `webDir` pointe sur `public`, elles sont copiées dans les ressources Android : `android/app/src/main/assets` pèse 112 Mo (mesuré sur le disque), alors que l'application charge `https://app.unkast.com` et ne s'en sert pas. Le fond d'accueil passe bien par `next/image` (donc servi converti et redimensionné), mais sa source de 8,5 Mo doit être transformée à chaque expiration du cache d'images.
- **Risque concret** : APK alourdi d'environ 110 Mo (estimé à partir du dossier de ressources ; l'APK n'a pas été construit), dépôt et déploiement plus lents, première transformation lente du fond d'accueil.
- **Impact estimé** : moyen pour le poids de l'application Android, faible pour le site.
- **Correction proposée** : vérifier en base qu'aucun film ne pointe vers `/thumbnails/...`, puis retirer ces fichiers (suppression = validation explicite requise). Réenregistrer `welcome-bg.png` en WebP ou AVIF à une taille raisonnable. Faire pointer `webDir` vers un dossier minimal. Un rebuild de l'APK sera nécessaire pour en voir l'effet.

### M10. Réglages d'image en retard sur Next 16

- **Où** : `src/app/(app)/feed/HeroCarousel.tsx` ligne 184, `src/app/(app)/projet/[slug]/ProjetClient.tsx` ligne 288, `src/app/WelcomeClient.tsx` ligne 73 (`priority`) ; `next.config.ts` ligne 27 (`minimumCacheTTL: 3600`).
- **Ce qui ne va pas** : la propriété `priority` est dépréciée depuis Next 16 au profit de `preload` (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` ligne 293). La durée de cache des images optimisées est fixée à 1 h alors que la valeur par défaut de Next 16 est de 4 h (même fichier, ligne 783).
- **Risque concret** : avertissement de dépréciation aujourd'hui, comportement à revoir lors d'une montée de version. Images retransformées quatre fois plus souvent que le réglage par défaut.
- **Impact estimé** : faible.
- **Correction proposée** : remplacer `priority` par `preload` (ou `fetchPriority="high"`, que la documentation recommande dans la plupart des cas, ligne 289). Retirer `minimumCacheTTL` ou l'augmenter, les affiches changeant rarement d'adresse.

### M11. JetBrains Mono préchargée sur toutes les pages

- **Où** : `src/app/layout.tsx` lignes 11 à 15.
- **Ce qui ne va pas** : la police à chasse fixe est préchargée partout (31 340 o, mesuré) alors qu'elle ne sert qu'à de petits libellés (32 occurrences de `font-mono` dans `src/`). Les polices sont variables : les 5 graisses de DM Sans et les 3 de JetBrains Mono tiennent chacune dans un seul fichier, il n'y a donc pas de surcoût par graisse.
- **Risque concret** : 31 Ko téléchargés en priorité haute, en concurrence avec l'affiche et le JavaScript.
- **Impact estimé** : faible.
- **Correction proposée** : passer `preload: false` sur JetBrains Mono (elle se chargera à la première utilisation, avec la police de repli en attendant).

### M12. Grain plein écran fixe au-dessus de toute l'interface

- **Où** : `src/app/globals.css` lignes 74 à 84.
- **Ce qui ne va pas** : un calque fixe couvre tout l'écran au-dessus du contenu (`z-index: 9998`) avec une texture SVG à 2,5 % d'opacité. Il n'est pas retiré en `.lite`.
- **Risque concret** : un calque plein écran de plus à composer à chaque image pendant le défilement. Coût non mesuré.
- **Impact estimé** : faible.
- **Correction proposée** : le retirer en `.lite`, ou mesurer son coût sur le téléphone de test avant de décider.

### M13. Film à la une : le minuteur ne s'arrête jamais et chaque changement charge une grande image

- **Où** : `src/app/(app)/feed/HeroCarousel.tsx` lignes 53 à 57 et 178 à 184.
- **Ce qui ne va pas** : le changement de film toutes les 8 s continue quand le bloc est sorti de l'écran ou que l'onglet est masqué. L'affiche principale des films 2 à 5 n'est demandée qu'au moment du changement.
- **Risque concret** : une animation avec flou et un rendu toutes les 8 s pour rien quand le bloc n'est pas visible ; affiche qui apparaît en retard lors du premier passage sur chaque film.
- **Impact estimé** : faible.
- **Correction proposée** : suspendre le minuteur hors écran et onglet masqué ; précharger l'affiche du film suivant pendant l'affichage du film courant.

### M14. Format d'une affiche connu seulement après son chargement

- **Où** : `src/components/FilmPoster.tsx` lignes 38 à 45, 57 à 59 et 67 à 73.
- **Ce qui ne va pas** : le rapport largeur/hauteur est lu dans `onLoad`, puis stocké dans l'état. Pour une affiche qui n'est pas en 16:9, cela déclenche un second rendu, le passage de `object-cover` à `object-contain`, et la demande d'une seconde image (fond flouté). Le cadre étant fixe, il n'y a pas de décalage de mise en page.
- **Risque concret** : un changement d'aspect visible après chargement et une requête d'image de plus par affiche concernée. La proportion d'affiches concernées dépend des données (non vérifiée).
- **Impact estimé** : faible à moyen selon les données.
- **Correction proposée** : enregistrer les dimensions de l'affiche à l'envoi (colonnes à ajouter par migration séparée) et les passer au composant, qui connaît alors le bon rendu dès le premier affichage.

### M15. Page d'accueil `/` : écran vide tant que le navigateur n'a pas interrogé l'authentification

- **Où** : `src/app/WelcomeClient.tsx` lignes 36 à 58 et 65.
- **Ce qui ne va pas** : la page est statique mais ne rend rien (`return null`) tant que `auth.getUser()` (appel réseau) n'a pas répondu. Un membre connecté voit donc un écran vide, puis une redirection côté navigateur vers `/feed`. Le fond d'accueil, pourtant marqué prioritaire, n'est demandé qu'après cette attente.
- **Risque concret** : l'ouverture de l'application (WebView comprise) commence par un écran vide dont la durée dépend du réseau : téléchargement de 213 Ko gzip de JavaScript (mesuré), puis un aller-retour d'authentification, puis la navigation vers le feed.
- **Impact estimé** : moyen pour la première impression (estimé, non mesuré).
- **Correction proposée** : décider de la redirection côté serveur ou dans le proxy à partir du cookie de session ; afficher l'écran d'accueil sans attendre pour un visiteur.

### M16. Index utilisé comme `key`

- **Où** : `src/app/(app)/feed/HeroCarousel.tsx` ligne 116, `src/components/SearchAssistant.tsx` ligne 552, `src/components/FilmMeta.tsx` ligne 36.
- **Ce qui ne va pas** : ces listes changent (équipe du film affiché, fil d'étapes de l'assistant) et utilisent l'index comme clé. Les éléments n'ont pas d'état propre.
- **Risque concret** : aucun défaut visible aujourd'hui ; React réutilise des éléments au lieu de les recréer, ce qui deviendrait un bug si l'un d'eux prenait un état ou une animation.
- **Impact estimé** : faible.
- **Correction proposée** : utiliser une clé tirée du contenu (nom, valeur de l'étape).

### M17. `/dashboard` : écran construit mais inatteignable

- **Où** : `next.config.ts` lignes 55 à 57, `src/app/(app)/dashboard/DashboardClient.tsx` (926 lignes).
- **Ce qui ne va pas** : `/dashboard` et `/dashboard/projets` sont redirigés de façon permanente vers `/moi`, mais leurs pages et `DashboardClient` sont toujours compilés (988 872 o de premier chargement déclaré pour une page que personne ne peut ouvrir).
- **Risque concret** : aucun pour l'utilisateur. Temps de build et code à maintenir pour rien.
- **Impact estimé** : faible.
- **Correction proposée** : à signaler à l'audit d'architecture. Suppression = validation explicite requise.

### M18. Admin : une à trois requêtes par ligne dans les onglets Signalements et Revendications

- **Où** : `src/app/api/admin/route.ts` lignes 62 à 70 et 221 à 232.
- **Ce qui ne va pas** : même schéma que I2 et I3, sans limite sur la liste.
- **Risque concret** : onglets admin lents quand la file s'allonge. Un seul utilisateur concerné.
- **Impact estimé** : faible.
- **Correction proposée** : lectures groupées par `in`, et une limite sur la liste.

### M19. Compteurs de catégories calculés en lisant tous les films

- **Où** : `src/app/(app)/recherche/page.tsx` lignes 16 à 24.
- **Ce qui ne va pas** : la page lit la colonne `category` de tous les films approuvés et compte en JavaScript. Avec I1, c'est refait à chaque affichage de `/recherche`.
- **Risque concret** : une lecture qui grossit avec le catalogue, sur une page très visitée.
- **Impact estimé** : faible aujourd'hui.
- **Correction proposée** : compter en base (fonction SQL ou vue, en migration séparée) et mettre le résultat en cache.

### M20. Service worker : cache d'images sans plafond ni expiration

- **Où** : `public/sw.js` lignes 4, 8 et 32 à 45.
- **Ce qui ne va pas** : toute image réussie est mise en cache et resservie indéfiniment, sans limite de nombre ni d'âge. À l'installation, le service worker demande `/`, `/feed` et `/recherche`, soit trois rendus de pages dynamiques supplémentaires à la première visite.
- **Risque concret** : stockage du téléphone qui grossit avec l'usage ; une affiche remplacée sous la même adresse ne serait jamais rafraîchie ; charge serveur en plus à la première visite.
- **Impact estimé** : faible.
- **Correction proposée** : plafonner le cache d'images (nombre d'entrées, âge maximal) et ne précharger que `/offline.html`.

---

## Non vérifié

- **Temps de chargement réels et Core Web Vitals (LCP, INP, CLS)** : aucun navigateur ni outil de mesure n'a été lancé (consigne : aucun serveur, aucun build).
- **Comportement sur téléphone** : fluidité du défilement, coût réel des flous, du grain et du filtre du dock dans la WebView Android, autonomie. Les constats I8, M12 et M13 reposent sur la lecture du code.
- **Tailles réellement transférées** : calculées en gzip local ; la compression Brotli de Vercel n'a pas été observée.
- **Dédoublonnage des requêtes Supabase** pendant un rendu serveur (M2, M3) : dépend de la mémoïsation automatique de `fetch` par React pour les GET identiques. Non observé à l'exécution.
- **Nombre réel de requêtes par page** : compté dans le code, pas dans les journaux de la base ni dans l'onglet réseau.
- **Poids réel des avatars** : estimé à partir du format d'envoi (512 x 512, WebP, qualité 0,8) ; aucun fichier stocké n'a été pesé.
- **Proportion d'affiches hors 16:9** (M14) et présence éventuelle d'adresses `/thumbnails/...` en base (M9) : aucune requête sur la base n'a été faite.
- **Poids réel de l'APK** : seul le dossier `android/app/src/main/assets` a été pesé (112 Mo). L'APK n'a pas été construit.
- **Effet de `experimental.optimizeCss`** (`next.config.ts` ligne 30) : non vérifié. Ni `critters` ni `beasties` n'apparaît à la racine de `node_modules` ; le build passe, mais rien ne prouve que l'option agit.
- **Index de la base** servant les requêtes citées : relève de l'audit base de données.
- **Rendus inutiles mesurés** : aucun profilage React. Les fichiers `DashboardClient.tsx`, `AdminClient.tsx`, `SearchAssistant.tsx`, `RechercheClient.tsx` et `RecruitmentSpace.tsx` ont été parcourus par recherche de motifs (effets, appels réseau, listes, images), pas lus ligne à ligne.

---

## Résumé chiffré

| Gravité | Nombre |
|---|---|
| Critique | 0 |
| Important | 9 |
| Mineur | 20 |
| **Total** | **29** |

Répartition des constats importants par impact estimé : élevé 2 (I1, I2), moyen 7 (I3 à I9).

Par où commencer, à effort égal : I5 (deux attributs sur `Avatar`), M4 (une requête à déplacer), M11 (un réglage de police), M1 (une condition sur l'intervalle). Les chantiers qui pèsent le plus : I1 (cache des pages publiques), I2 et I3 (requêtes par ligne), I6 et I7 (JavaScript initial).
