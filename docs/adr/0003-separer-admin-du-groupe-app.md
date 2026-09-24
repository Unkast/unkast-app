# ADR 0003 — Séparer /admin du groupe (app) avec une garde serveur

- Date : 2026-08-14
- Statut : accepté

## Contexte

Le back-office d'Unkast a d'abord vécu à l'intérieur du groupe de routes `(app)`, sous le même `AppShell` que les pages destinées aux utilisateurs. L'accès reposait alors sur l'affichage : le lien « Administration » n'apparaissait que si `is_admin`, et la page d'admin était rendue dans la même coquille que le reste.

Ce montage confond deux choses distinctes : cacher une entrée et interdire un accès. Une entrée cachée ne protège rien, l'URL reste connue et directement appelable. Le back-office donne accès à la suspension de comptes, à la modération des signalements, à l'approbation des recruteurs et à l'octroi du Pro : le contrôle d'accès y est un enjeu de sécurité, pas d'ergonomie.

## Décision

`/admin` sort du groupe `(app)` et vit dans `src/app/admin/`, avec son propre layout, sans `AppShell`.

L'autorisation est vérifiée côté serveur dans `src/app/admin/layout.tsx` via `getAdminId()` (`lib/adminGuard.ts`), helper partagé avec les routes `/api/admin`. Le lien affiché dans le menu utilisateur d'`AppShell` n'est qu'un confort de navigation : il ne constitue jamais l'autorisation.

## Raison

Le maintien de `/admin` dans `(app)` avec une garde côté client a été écarté. Une garde qui s'exécute dans le navigateur est une garde que l'utilisateur contrôle. La seule position défendable est le serveur, avant tout rendu.

Le partage de `getAdminId()` entre le layout et l'API est le point central de la décision. Deux implémentations séparées de la même règle divergent toujours, et c'est presque toujours l'API, moins visible, qui reste en arrière. Une seule fonction rend la divergence impossible.

La sortie du groupe `(app)`, elle, n'est pas qu'une affaire de sécurité : elle sépare structurellement deux produits qui n'ont ni les mêmes utilisateurs, ni les mêmes contraintes de rendu. Le back-office n'a aucune raison d'hériter de la navigation, du splash ou des animations de la vue client.

## Conséquences

La séparation duplique une partie de la coquille. Le layout admin refait sa propre navigation, et toute évolution transverse (charte, en-tête, gestion de session côté rendu) doit désormais être portée à deux endroits au lieu d'un. Cette duplication est acceptée : c'est le prix de la séparation, et elle porte sur du présentationnel, pas sur la règle d'autorisation, qui reste unique.

Le back-office diverge visuellement du reste de l'application et continuera de diverger. Personne ne le rattrapera lors d'une refonte, puisqu'il n'est plus dans le même arbre.

La garde est désormais un point de passage obligé au niveau du layout : la casser rend `/admin` inaccessible d'un coup, sans dégradation progressive. C'est le comportement voulu, mais il implique que toute modification de `lib/adminGuard.ts` se teste réellement, y compris le cas du profil non-admin et celui du profil absent.
