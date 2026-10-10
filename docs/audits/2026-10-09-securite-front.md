# Audit de sécurité côté navigateur

Date : 09/10/2026
Périmètre : composants et pages de `src/` rendus dans le navigateur, service worker (`public/sw.js`), hooks (`src/hooks`), configuration (`next.config.ts`), et les routes dont l'interface masque l'accès.
Mode : lecture seule. Aucune correction appliquée.

Règle de départ : le navigateur n'est jamais une frontière. Tout ce qu'il reçoit est public, tout ce qu'il masque reste appelable.

## Vue d'ensemble

Le rendu est sain : aucun contenu de membre n'est injecté comme HTML, aucun script tiers n'est chargé, les polices sont servies par le site, rien de sensible n'est écrit dans le stockage local, et les fiches publiques ne reçoivent ni vrai nom ni coordonnée.

Un contrôle n'existe que dans l'interface : l'ouverture des abonnements.

---

## Critique

### C1. Les abonnements sont fermés dans l'interface, pas sur le serveur

- **Où** : `src/app/(app)/pro/page.tsx` lignes 37 et 113 (`showCheckout = BILLING_ENABLED || isAdmin`) d'un côté ; `src/app/api/billing/checkout/route.ts` lignes 11 à 59 de l'autre, qui ne lit ni `NEXT_PUBLIC_BILLING_ENABLED` ni `is_admin`.
- **Ce qui ne va pas** : tant que le lancement n'est pas fait, la page `/pro` montre la liste d'attente au public et réserve les boutons d'achat aux admins. La route, elle, crée une session de paiement pour n'importe quel compte actif.
- **Risque concret** : `.env.local.example` (lignes 29 à 31) indique que Stripe reste en mode test jusqu'au lancement. Si les clés de test sont celles de la production, un membre qui appelle la route à la main paie avec une carte de test Stripe, le webhook passe son compte en Pro, et il obtient gratuitement la messagerie sans quota et l'espace de recrutement. Si les clés ne sont pas définies, la route répond simplement en erreur.
- **Correction proposée** : dans la route, refuser (403) quand `NEXT_PUBLIC_BILLING_ENABLED` n'est pas `true` et que l'appelant n'est pas admin : la même règle que la page, appliquée côté serveur.

---

## Important

### I1. Les notifications continuent d'arriver après la déconnexion

- **Où** : `src/hooks/usePushNotifications.ts` lignes 22 à 30 (le jeton de l'appareil est enregistré à la connexion), `src/components/AppShell.tsx` lignes 474 à 486 (`handleSignOut`) et `src/app/api/logout/route.ts` : rien ne retire ce jeton à la déconnexion. `src/lib/push.ts` ne le supprime que lorsque Firebase le déclare invalide.
- **Ce qui ne va pas** : après déconnexion, l'appareil reste rattaché au compte.
- **Risque concret** : sur un téléphone partagé, prêté ou revendu, les notifications du compte précédent continuent de s'afficher : nom de l'expéditeur et début de chaque message (80 caractères, `src/app/api/messages/route.ts` ligne 246), invitations, crédits. Elles s'arrêtent seulement quand un autre compte se connecte sur le même appareil.
- **Correction proposée** : garder le jeton côté client, et à la déconnexion appeler une route qui supprime cette ligne de `push_tokens` avant de fermer la session.

---

## Mineur

### M1. Liens de l'admin construits depuis une saisie de membre, sans contrôle du protocole

- **Où** : `src/app/admin/(panel)/AdminClient.tsx` ligne 173 (`href={f.video_url}`) et ligne 525 (`href={r.recruiter_website}`). Côté serveur, `video_url` n'est contrôlé que comme chaîne (`src/app/api/dashboard/projects/route.ts` ligne 198 ; une plateforme non reconnue passe sans contrôle, `src/lib/oembed.ts` ligne 21) et `recruiter_website` est enregistré tel quel (`src/app/api/signup/route.ts` ligne 144).
- **Ce qui ne va pas** : un membre peut soumettre une adresse `javascript:` ou une adresse trompeuse, affichée comme lien dans l'admin.
- **Risque concret** : faible aujourd'hui. React 19 neutralise les adresses `javascript:` dans un `href`, donc pas d'exécution de script. Reste un lien externe arbitraire présenté à l'admin (hameçonnage), et une protection qui tient à la bibliothèque plutôt qu'au code. Les liens « site web » et « Instagram » des membres passent, eux, par `normalizeUrl` (`src/lib/profile.ts` lignes 62 à 70), qui impose `http` ou `https`.
- **Correction proposée** : refuser à l'enregistrement toute adresse qui ne commence pas par `http://` ou `https://`, et passer ces deux liens par `normalizeUrl`.

### M2. Le service worker garde en cache des pages d'un compte connecté

- **Où** : `public/sw.js` lignes 4 à 11 (`/`, `/feed` et `/recherche` mis en cache à l'installation) et lignes 49 à 58 (repli sur le cache hors connexion). Aucun vidage à la déconnexion.
- **Ce qui ne va pas** : si le service worker s'installe pendant qu'un membre est connecté, la page `/feed` mise en cache contient son nom et son avatar dans la barre latérale.
- **Risque concret** : faible. Hors connexion, après déconnexion, la page servie montre encore le nom du compte précédent. Aucun message ni donnée privée n'est en cache : les réponses d'API ne sont jamais stockées.
- **Correction proposée** : ne mettre en cache à l'installation que `/offline.html`, ou vider le cache à la déconnexion.

### M3. Journal de console et navigation libre depuis une notification

- **Où** : `src/hooks/usePushNotifications.ts` ligne 41 (`console.log("Push received:", notification)`) et lignes 45 à 49 (`window.location.href = data.url`).
- **Ce qui ne va pas** : le contenu de chaque notification reçue est écrit dans la console en production. L'adresse ouverte au toucher d'une notification n'est pas limitée à un chemin interne.
- **Risque concret** : très faible. Les notifications ne viennent que du serveur, avec des chemins internes. Une notification forgée par quelqu'un qui détiendrait la clé Firebase ouvrirait n'importe quelle adresse dans l'app.
- **Correction proposée** : retirer le journal, et n'ouvrir l'adresse que si elle commence par `/`.

### M4. Réponses d'API qui renvoient des lignes entières

- **Où** : `select("*")` renvoyé au navigateur dans `src/app/api/messages/[conversationId]/route.ts` ligne 30, `src/app/api/invitations/project/route.ts` lignes 72 et 82, `src/app/api/dashboard/credits/route.ts` lignes 26, 48 et 69, `src/app/api/dashboard/projects/route.ts` lignes 96 et 108.
- **Ce qui ne va pas** : toutes ces lignes appartiennent à l'appelant (ses messages, ses invitations, ses films), donc rien ne fuit aujourd'hui. Mais toute colonne ajoutée plus tard à ces tables partira au navigateur sans que personne ne l'ait décidé.
- **Risque concret** : aucun aujourd'hui. Dette.
- **Correction proposée** : nommer les colonnes renvoyées, comme le font déjà la fiche publique et la recherche.

---

## Points vérifiés sans constat

- **Injection de HTML** : deux `dangerouslySetInnerHTML` seulement, tous deux sur des chaînes fixes écrites dans le code (`src/app/layout.tsx` ligne 68, `src/components/AppShell.tsx` ligne 582). Aucun `innerHTML`, `eval` ni `document.write`.
- **Stockage local** : trois clés, sans donnée sensible (date du dernier écran d'accueil, bandeau fermé, visite en cours). La session Supabase est dans des cookies, pas dans `localStorage`.
- **Cookies de session lisibles en JavaScript** : réglage imposé par le client Supabase du navigateur. Sans politique de contenu, c'est ce qu'un script injecté viserait : voir `docs/audits/2026-10-09-securite.md`, constat I1.
- **Scripts tiers** : aucun. Les polices passent par `next/font`, donc servies par le site.
- **Cadres** : uniquement les lecteurs YouTube et Vimeo, chargés au clic.
- **`postMessage`** : aucun usage dans `src`.
- **Liens externes** : tous les liens vers l'extérieur portent `rel="noopener noreferrer"`. Les liens `target="_blank"` sans `rel` de l'admin pointent vers des pages du site.
- **Formulaires** : champs de mot de passe correctement typés, formulaires envoyés au site lui-même en HTTPS.
- **Fiche publique et recherche** : colonnes nommées une à une, vrai nom et coordonnées exclus (`src/app/(app)/profil/[slug]/page.tsx` lignes 51 à 69).
- **Contrôles doublés côté serveur** : badge « Je recrute », quota de films, quota de messages, changement de type de compte, accès admin. Seuls les abonnements font exception (C1).
- **Cartes de source** : `productionBrowserSourceMaps` absent de `next.config.ts`, donc désactivées.

## Non vérifié

- **Clés Stripe de production** (C1) : pas d'accès aux variables de Vercel. Impossible de dire si elles sont en mode test, en mode réel ou absentes. La gravité du constat en dépend.
- **Bundle de production** : aucun build lancé, le contenu réellement servi (cartes de source, variables incluses) n'a pas été inspecté.
- **Application Android** : réglages de la WebView (débogage, accès aux fichiers, liens profonds) et widget, hors périmètre de cet audit.
- **Comportement réel du service worker** en production (contenu du cache sur un appareil) : déduit du code.
- **Rendu d'un contenu piégé** : aucun profil ni film de test n'a été créé pour vérifier l'échappement à l'écran.

## Résumé chiffré

| Gravité | Nombre |
|---|---|
| Critique | 1 |
| Important | 1 |
| Mineur | 4 |
| **Total** | **6** |
