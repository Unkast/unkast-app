# ADR 0006 — Faire du webhook Stripe la source souveraine du plan

- Date : 2026-08-14
- Statut : accepté

## Contexte

Le Pro d'Unkast provient de deux sources qui peuvent se cumuler : un abonnement Stripe, et un Pro offert par l'administration sous forme de grant, avec un type et une échéance.

Deux sources écrivant la même colonne `profiles.plan` conduisent mécaniquement à ce que la dernière écriture gagne. Un grant administrateur posé après une résiliation, ou un webhook arrivant après un octroi manuel, pouvaient chacun effacer l'autre sans que rien ne le signale.

S'ajoute la nature de Stripe : les webhooks sont livrés au moins une fois, dans un ordre non garanti, et rejoués en cas d'échec. Une logique qui écrit directement l'état final à la réception d'un événement est fausse par construction.

## Décision

`profiles.plan` n'est jamais écrit directement, ni par le webhook, ni par le checkout, ni par l'administration. Chaque source met à jour uniquement ses propres champs, puis appelle la RPC `recompute_plan(p_profile_id)`, seule fonction autorisée à écrire `plan` et `pro_since`.

`recompute_plan` est `SECURITY DEFINER` et réservée au `service_role` : les rôles `public`, `anon` et `authenticated` en sont explicitement révoqués (`supabase/migrations/20260810_pro_grants.sql`).

Le webhook reste souverain sur l'état de l'abonnement Stripe, mais il n'est pas souverain sur le plan : il déclare ce que Stripe sait, l'arbitrage entre abonnement et grant appartient à la RPC. Un utilisateur dont l'abonnement s'arrête reste Pro tant que son grant est valide.

## Raison

L'écriture directe du plan au moment du checkout a été écartée. Elle donne un résultat immédiat et lisible, mais elle place la décision dans le processus le moins fiable de la chaîne : celui qui dépend du retour du navigateur de l'utilisateur.

Centraliser l'arbitrage dans une fonction SQL unique rend l'opération idempotente et rejouable. Le même événement Stripe livré trois fois produit le même état, et l'ordre d'arrivée cesse d'être un facteur de correction.

Le placement en base plutôt qu'en TypeScript est délibéré. Les écrivains sont multiples (webhook, back-office, cron d'expiration) et le seront encore ; une règle en base s'applique à tous, y compris à une intervention manuelle en SQL. `src/lib/pro-plan.ts` maintient un miroir de la règle de validité côté TypeScript, mais en lecture seule : il n'écrit rien.

## Conséquences

La règle d'arbitrage du plan vit en SQL, pas dans le code applicatif. Elle échappe donc au typage TypeScript, à la revue de code habituelle et au test unitaire ordinaire, et sa modification passe par une migration exécutée manuellement (voir [ADR 0008](0008-migrations-sql-manuelles.md)). C'est le coût accepté de la centralisation.

`src/lib/pro-plan.ts` duplique volontairement la règle de validité en lecture. Cette duplication est une dette connue : si la RPC évolue sans que le miroir suive, l'interface affichera un état que la base contredit, et le bug sera silencieux. Le commentaire dans le fichier signale cette contrainte, rien ne l'impose mécaniquement.

Le chemin est enfin plus long à déboguer. Entre le paiement et le plan affiché s'intercalent un webhook, une RPC et un recalcul : diagnostiquer « pourquoi cet utilisateur n'est pas Pro » demande de traverser les trois, au lieu de lire une seule écriture.
