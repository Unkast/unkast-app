# ADR 0004 — Échouer fermé par défaut, n'ouvrir que sur erreur transitoire

- Date : 2026-08-14
- Statut : accepté

## Contexte

Plusieurs gardes d'Unkast interrogent Supabase avant de décider : le rate-limit des endpoints publics, la lecture de `is_admin` et `is_suspended` dans le proxy, les comptages de quota de la messagerie. Chacune doit répondre à la même question : que faire quand la lecture échoue ?

La réponse par défaut, en l'absence de règle, est l'ouverture. C'est celle qui vient naturellement, parce qu'elle préserve le service. C'est aussi celle qui fait céder les protections précisément au moment où elles servent le plus, puisqu'une infrastructure sous pression est le contexte normal d'un abus.

## Décision

En cas d'échec, une garde refuse. Le fail-open est réservé aux erreurs dont la nature transitoire est établie (réseau, 5xx, saturation de pool), et il est toujours accompagné d'un log qui rend l'incident visible.

Une erreur permanente ne bénéficie jamais du fail-open, même si elle ressemble à une absence de donnée. `src/lib/supabase/middleware.ts` en donne le cas de référence : un `PGRST116` sur `is_suspended` signale un utilisateur Auth sans ligne `profiles`, condition permanente, donc fail-closed vers `/compte-introuvable` plutôt que vers `/suspended`, qui mentirait sur la cause.

La seule dérogation tolérée est l'absence de RPC hors production : `checkRateLimit()` autorise sur `PGRST202` et `42883` quand `NODE_ENV !== "production"`, pour ne pas bloquer le développement local. En production, ce cas reste fermé.

## Raison

Le fail-open généralisé a été écarté parce qu'il inverse la charge au mauvais moment. Un rate-limit qui s'efface quand la base flanche ouvre la création de comptes et l'envoi d'emails en masse pendant l'incident, c'est à dire qu'il transforme une panne en brèche.

La distinction transitoire / permanent est le coeur de la décision, et elle n'est pas une nuance de confort. Traiter un profil orphelin comme une panne réseau produirait une boucle de redirection ou un message faux ; le diagnostic doit être porté par le code d'erreur, pas deviné.

L'exception hors production est bornée à deux codes d'erreur et à un environnement, précisément pour qu'elle ne puisse pas dériver en tolérance générale.

## Conséquences

Un incident Supabase se traduit désormais par des refus visibles côté utilisateur, là où le fail-open aurait laissé passer sans bruit. La panne devient donc plus voyante, ce qui est le comportement recherché mais reste un coût réel en expérience : un utilisateur légitime peut être bloqué par une erreur qui ne le concerne pas.

L'exception hors production crée un écart de comportement entre développement et production. Un chemin fail-closed peut ne jamais être exercé localement et ne se révéler qu'en production, ce qui est exactement le pire moment. Cet écart est accepté, mais il implique que les chemins d'échec soient testés délibérément, sans compter sur l'usage quotidien pour les rencontrer.

Enfin, la règle est répartie sur plusieurs fichiers plutôt que centralisée dans un helper unique. Chaque garde doit donc décider elle-même de la classe de son erreur, et rien n'empêche mécaniquement une nouvelle garde d'être écrite en fail-open par inadvertance. C'est la limite connue de cette décision : elle tient par la discipline et par la revue, pas par le typage.
