# ADR 0002 — Ouvrir la plateforme sur candidature, pas en libre accès

- Date : 2026-08-14
- Statut : accepté

## Contexte

La valeur d'Unkast pour un recruteur tient entièrement à la qualité de ce qu'il trouve. Une plateforme de découverte de talents dont le catalogue se remplit de profils vides, de faux comptes ou de films sans rapport avec l'audiovisuel professionnel perd son intérêt à la première visite, et le perd définitivement.

Au lancement, le volume d'inscriptions est faible et le fondateur est seul. Le coût d'une revue manuelle est donc supportable, alors que le coût d'une réputation de catalogue bruité ne l'est pas.

## Décision

Un profil est créé avec `profiles.status = 'pending'` et n'est visible publiquement qu'une fois passé à `'approved'`. La transition est un acte d'administration explicite, pas un effet du temps ou d'une action de l'utilisateur.

Les RLS Supabase portent cette règle : un profil `pending` n'est lisible que par son propriétaire, et les projets suivent la visibilité du profil qui les porte. La garde est en base, pas seulement dans les pages.

## Raison

L'inscription libre a été écartée. Elle aurait rempli le catalogue vite, mais avec un contenu invérifiable, au moment précis où chaque visite de recruteur compte le plus. Un catalogue mince et sûr se défend devant un producteur, un catalogue large et douteux ne se défend pas.

Le placement de la règle dans les RLS plutôt que dans le code applicatif est délibéré. Les profils sont lus par le feed, la recherche, les pages profil et projet, les crédits croisés et l'API : une garde applicative aurait dû être répétée partout et aurait fini par être oubliée quelque part. En base, l'oubli n'est pas possible.

## Conséquences

L'inscription ne se termine pas par une gratification. L'utilisateur finit son wizard sur un écran d'attente, au moment où sa motivation est la plus haute, et une partie de ces profils ne reviendra jamais voir s'ils ont été approuvés. C'est le coût direct et assumé de la décision.

L'approbation est un travail humain récurrent qui ne se délègue pas au produit. Il occupe le fondateur, et il ne passe pas à l'échelle : à volume soutenu, soit une équipe de modération apparaît, soit la file d'attente s'allonge jusqu'à décrédibiliser l'inscription. Cette décision porte donc en elle sa propre date de péremption, et devra être révisée plutôt que subie.

La conséquence à surveiller est le silence : rien dans le produit ne prévient un candidat qu'il a été approuvé ou refusé, `resend` étant installé mais non connecté. Tant que ce chaînon manque, la file d'attente est une impasse du point de vue de l'utilisateur.
