# ADR 0016 — Connecter Google par jeton d'identité, sans redirection par Supabase

- Date : 2026-10-10
- Statut : accepté

## Contexte

La connexion Google passait par `supabase.auth.signInWithOAuth` : le navigateur partait vers `<projet>.supabase.co`, puis Google, puis revenait sur `/auth/callback`. Deux défauts :

- l'écran de Google affichait l'adresse du projet Supabase au lieu d'Unkast. Le seul remède de ce flux est le domaine personnalisé Supabase, une option payante ;
- dans l'app Android (coque Capacitor, ADR 0011), Google refuse la connexion dans une webview : le flux s'ouvrait dans Chrome, la session se créait dans Chrome et l'utilisateur revenait dans l'app sans être connecté. Le chantier 11 de la ROADMAP prévoyait un retour par deep-link.

## Décision

La connexion Google se fait par **jeton d'identité** : Google remet un jeton à la page ou à l'app, et `supabase.auth.signInWithIdToken` ouvre la session. Plus aucune redirection par l'adresse du projet Supabase.

- **Web** : bouton officiel « Sign in with Google » (Google Identity Services), rendu par Google, thème sombre en pilule.
- **App Android** : sélecteur de comptes natif (Credential Manager) par le plugin `@capgo/capacitor-social-login`. L'utilisateur ne quitte jamais l'app.
- Un seul composant, `src/components/GoogleSignInButton.tsx`, porte les deux chemins. Un nonce est généré à chaque fois : Google reçoit son empreinte SHA-256, Supabase la valeur d'origine.
- Après la connexion, `POST /api/auth/google` crée le profil minimal à la première connexion et répond où aller. La règle est celle de l'ancien `/auth/callback`, partagée dans `src/lib/google-account.ts` : finalisation obligatoire, case des CGU enregistrée à la création du profil.
- Le compte admin reste fermé à Google (ADR 0015) : `sessionStrength` exige la méthode `password`, qu'une session ouverte par jeton n'a pas.

## Raison

- Le domaine personnalisé Supabase a été écarté : payant, et il ne réglait pas le problème de l'app.
- Le deep-link OAuth (chantier 11 d'origine) a été écarté : il gardait un passage par Chrome, demandait un intent-filter et un échange de code dans la webview, pour un résultat moins bon que le sélecteur natif.
- Un plugin Kotlin maison a été écarté au profit de `@capgo/capacitor-social-login` : compatible Capacitor 8, nonce transmis tel quel à Credential Manager, aucune modification de `MainActivity`. Seul le fournisseur Google est embarqué (`plugins.SocialLogin.providers` dans `capacitor.config.ts`).

## Conséquences

- Google impose son bouton sur le web : il remplace le bouton en verre. Il ne se désactive pas ; tant que la case des CGU n'est pas cochée, son conteneur est rendu inerte.
- Le script de Google (`accounts.google.com/gsi/client`) est chargé sur `/connexion` et à l'étape 2 de `/rejoindre`, avant tout clic. C'est le seul script tiers chargé sans action de l'utilisateur : la page de confidentialité doit le mentionner.
- Configuration à tenir à jour hors du code : client Web (origines JavaScript), un client Android par empreinte SHA-1 de signature, identifiants autorisés dans Supabase. Une empreinte manquante se traduit par un échec de connexion dans l'app seulement.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` absent : le composant retombe sur l'ancien flux (`signInWithOAuth` puis `/auth/callback`), conservé pour cette raison. Il pourra être supprimé une fois le nouveau flux validé en production.
- Un ancien APK, sans le plugin, n'affiche plus de bouton Google (il n'y fonctionnait pas).
- La configuration des fournisseurs du plugin est écrite dans `node_modules` par `npx cap sync android` : à relancer après un `npm install`, avant de construire l'APK.
