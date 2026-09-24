# ADR 0008 — Exécuter les migrations SQL manuellement depuis un fichier versionné

- Date : 2026-08-14
- Statut : accepté

## Contexte

Le schéma Supabase d'Unkast porte des éléments dont une modification erronée n'est pas rattrapable par un correctif applicatif : les politiques RLS qui décident de la visibilité des profils (voir [ADR 0002](0002-inscription-sur-candidature.md)), la RPC `recompute_plan` qui arbitre le plan payant (voir [ADR 0006](0006-webhook-stripe-souverain.md)), les contraintes et les index.

Le serveur MCP Supabase expose `apply_migration`, qui permet d'appliquer une migration directement sur le projet distant depuis l'agent. Il n'existe pas d'environnement de préproduction : le projet Supabase visé est celui de production.

## Décision

Toute migration est fournie sous forme de fichier SQL versionné dans `supabase/migrations/`, et exécutée manuellement par Maxime dans le SQL Editor de Supabase.

Aucun agent n'exécute de migration, et `apply_migration` n'est pas utilisé sur ce projet. La rédaction du SQL et son application sont deux actes distincts, portés par deux acteurs distincts.

## Raison

L'exécution automatique via le MCP Supabase a été écartée. Elle supprime le seul point de contrôle humain qui sépare une proposition d'agent d'une modification irréversible du schéma de production. Un `drop` ou une politique RLS trop permissive appliquée sans relecture n'a pas d'annulation : la donnée est perdue ou exposée avant que l'erreur ne soit constatée.

Le déséquilibre des coûts tranche la question. Le coût de l'exécution manuelle est de quelques minutes par migration. Le coût d'une RLS ouverte par erreur sur une base de profils réels est une fuite de données, et il ne se rattrape pas.

L'exigence du fichier versionné, distincte de l'exigence d'exécution manuelle, répond à un autre besoin : une migration appliquée sans trace dans le repo est une modification que personne ne peut plus relire ni rejouer. Le fichier fait office d'historique, la revue humaine fait office de garde.

Le fait que le SQL passe sous les yeux d'un humain avant exécution est aussi la seule occasion réelle de relire ce que l'agent a produit, à un endroit où le typage TypeScript et le linter n'offrent aucune protection.

## Conséquences

Le déploiement n'est pas atomique. Le code et le schéma avancent séparément, avec une fenêtre entre les deux pendant laquelle l'application tourne contre une base qui n'a pas encore la colonne, la contrainte ou la RPC attendue. L'ordre des opérations devient donc un élément du plan de livraison, pas un détail.

Une migration peut être oubliée. Rien n'empêche du code d'être livré alors que son SQL n'a jamais été exécuté, et l'erreur ne se manifeste qu'à l'exécution, en production. `lib/rate-limit.ts` en porte la marque : il tolère explicitement l'absence de sa RPC hors production, ce qui est une concession directe à ce mode de travail.

Le processus ne passe pas à l'échelle au-delà d'un opérateur unique. Il repose sur la disponibilité de Maxime, qui devient un point de passage obligé de toute évolution du schéma, y compris urgente.

Rien ne garantit enfin que le fichier versionné soit exactement ce qui a été exécuté. Un ajustement fait à la main dans le SQL Editor et non reporté dans le repo est indétectable, et cette divergence silencieuse est le principal angle mort de la décision.
