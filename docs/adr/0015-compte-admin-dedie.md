# ADR 0015 : compte admin dédié, mot de passe et double authentification

Date : 09/10/2026
Statut : accepté

## Contexte

Les droits admin étaient portés par le compte personnel du fondateur (`profiles.is_admin`), connecté le plus souvent par Google, sans second facteur. Ce compte a aussi un profil public, des films et des messages : une session volée ou un simple oubli de déconnexion donnait l'accès à la modération.

## Décision

1. **Un compte dédié** (`admin@unkast.com`) porte les droits admin. Sa ligne `profiles` a `is_admin = true` et `account_type = 'admin'`.
2. **Trois conditions, vérifiées côté serveur** par la garde unique `getAdminId()` (`src/lib/adminGuard.ts`), reprise par le proxy : `is_admin`, session ouverte par email et mot de passe (méthode `password` dans le jeton, donc pas Google), double authentification validée (MFA TOTP Supabase, niveau `aal2`).
3. **Connexion séparée** : `/admin/connexion` (sans Google) puis `/admin/mfa` (inscription du facteur à la première connexion, code ensuite).
4. **Aucune existence publique** : `account_type = 'admin'` ne donne aucun droit, il en retire. Policy RLS restrictive (la ligne n'est lisible que par le compte lui-même), triggers qui refusent le compte dans `conversations` et `project_credits`, garde d'écriture `getActiveUser()` qui refuse ce compte, proxy qui ferme `/moi`, `/messages`, `/dashboard`, `/rejoindre`, `/pro` et saute la finalisation et l'écran CGU.
5. **« Voir le site comme »** : « membre » est l'état normal du compte admin sur le site. « Visiteur » pose le cookie `unkast_view=visitor`, qui fait ignorer la session par `createClient()` côté serveur (hors `/admin`).

## Pourquoi la ligne `profiles` est conservée

`admin_logs.admin_id`, `reports.reviewed_by` et `profiles.pro_grant_granted_by` référencent `profiles(id)`. Une table d'admins séparée aurait demandé de migrer ces clés.

## Conséquences

- Un compte `is_admin` connecté par Google n'a plus accès à `/admin` ni à `/api/admin`.
- Téléphone perdu : aucun parcours de récupération dans l'app. Le facteur se supprime par SQL (`delete from auth.mfa_factors where user_id = ...`), puis nouvelle inscription à la connexion suivante.
- La vue « visiteur » ne couvre que le serveur : les rares lectures faites directement par le navigateur (`useUserStatus`, vérifications de la fiche profil) restent connectées.
- Le cookie de vue ne donne aucun droit : n'importe qui peut le poser, il ne fait que retirer la session côté serveur. Il est effacé à la déconnexion et à l'ouverture de `/admin/connexion`.
