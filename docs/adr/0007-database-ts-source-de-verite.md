# ADR 0007 — Traiter src/types/database.ts comme la source de vérité du schéma

- Date : 2026-08-14
- Statut : accepté

## Contexte

Deux fichiers du repo prétendent décrire le schéma Supabase : `supabase/schema.sql`, écrit à la main au démarrage du projet, et `src/types/database.ts`, jeu d'interfaces TypeScript utilisé par l'ensemble du code.

Les deux ont divergé de la base de production, mais pas dans les mêmes proportions. L'audit du 13/06/2026 a établi que `schema.sql` ne décrivait plus que 5 tables, quand `database.ts` en couvrait 15, avec `profiles` à 35 colonnes et `projects` à 12, obtenues par introspection de la base réelle.

Une documentation qui décrit une base disparue est pire qu'absente : elle est consultée, et elle induit en erreur.

## Décision

`src/types/database.ts` est la source de vérité du schéma. En cas de contradiction avec `supabase/schema.sql`, c'est `database.ts` qui fait foi, et le fichier SQL qui est considéré comme en retard.

Toute lecture du schéma passe par ce fichier ou par `docs/database.md`, jamais par `supabase/schema.sql` tant que celui-ci n'a pas été régénéré.

## Raison

Désigner `schema.sql` comme référence a été écarté pour une raison de fait : il n'était plus juste. Nommer source de vérité un fichier faux ne le rend pas vrai, cela transfère seulement l'erreur à quiconque le consulte.

Le critère de choix a été le couplage à l'usage. `database.ts` est importé par la quasi-totalité des fichiers du projet ; une colonne absente ou mal typée s'y voit à la compilation, ce qui lui donne une pression de correction permanente. `schema.sql` n'est importé par rien : il peut vieillir indéfiniment sans qu'aucun signal ne se déclenche, ce qui est exactement ce qui s'est produit.

Le fichier a par ailleurs été reconstruit par introspection de la base plutôt que par relecture, ce qui lui donne une garantie d'origine que le SQL manuel n'a pas.

## Conséquences

La source de vérité du schéma n'est pas du SQL. Elle ne peut donc pas être rejouée pour reconstruire une base : un environnement neuf ne se crée pas depuis `database.ts`, et le repo ne contient plus de moyen fiable de reconstituer la base de zéro. C'est l'inconvénient central et assumé de cette décision.

`supabase/schema.sql` reste dans le repo tout en étant faux. Il constitue un piège pour quiconque le lit sans connaître cette décision, et sa régénération reste un chantier ouvert documenté dans `docs/database.md`.

`database.ts` étant un fichier écrit à la main plutôt que généré (les clients Supabase ne sont pas génériques, il n'existe pas de type `Database`), il peut lui aussi dériver de la base réelle. La décision déplace donc le risque, elle ne le supprime pas : elle le place seulement là où le compilateur en attrape une partie.

Le fichier est enfin un composant critique consommé par tout le projet : une modification erronée casse le typage de l'application entière, pas une fonctionnalité isolée.
