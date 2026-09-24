# ADR 0009 — Faire primer le code source sur la documentation

- Date : 2026-08-14
- Statut : accepté

## Contexte

Unkast impose la consultation de `docs/` avant toute modification de fichier. Cette obligation n'a de sens que si la documentation est juste, et l'audit du 13/06/2026 a montré qu'elle ne l'était pas.

Les écarts constatés ne sont pas des approximations de rédaction, ce sont des affirmations fausses. `docs/architecture.md` portait les notes « aucun hook custom », « `slugify()` dupliquée » et « pas d'admin API », toutes contredites par le code. Le même fichier a annoncé un maximum de 2 films en version gratuite alors que `src/lib/constants.ts` fixait `MAX_PROJECTS_FREE = 3` depuis le 2026-08-10, écart corrigé le 2026-08-14. `docs/components-critiques.md` décrit `lib/rate-limit.ts` comme « fail-open si migration absente », alors que le fichier est fail-closed par défaut et ne tolère l'absence de RPC qu'en dehors de la production.

Une documentation volumineuse, lue systématiquement et partiellement fausse est un amplificateur d'erreur : elle est appliquée avec d'autant plus de confiance qu'elle a été rendue obligatoire.

## Décision

Le code source fait foi. Lorsqu'un fichier `docs/` contredit le code, la contradiction se tranche en faveur du code, et c'est la documentation qui est corrigée.

La documentation sert à orienter, à repérer les dépendances et à comprendre les intentions. Elle ne sert jamais à établir un fait technique : un comportement, une valeur ou une signature se vérifient dans le fichier concerné avant d'être utilisés.

## Raison

L'alternative, faire primer la documentation, a été écartée. Elle supposerait que `docs/` soit maintenu avec la même rigueur que le code, ce que l'audit a démenti dans les faits. Une règle qui suppose une discipline que le projet n'a pas tenue est une règle qui échoue en silence.

Le déséquilibre des mécanismes de correction est déterminant. Le code est exécuté, typé, linté : une affirmation fausse dans `src/` finit par se manifester. Un paragraphe faux dans `docs/` ne déclenche rien et peut survivre indéfiniment. Deux artefacts dont les taux de dérive diffèrent à ce point ne peuvent pas avoir la même autorité.

La décision est aussi la condition de survie de l'obligation de consultation. Sans elle, il faudrait choisir entre imposer la lecture d'une source non fiable et abandonner la documentation ; la hiérarchie explicite permet de garder les deux, en assignant à chacune ce qu'elle sait faire.

## Conséquences

Le gain de temps promis par la documentation est partiellement annulé. Lire `docs/` ne dispense pas d'ouvrir le code, ce qui ajoute une étape à chaque tâche au lieu d'en retirer une, et rend la consultation moins rentable qu'elle n'en a l'air.

La règle a un effet pervers assumé : elle réduit la pression de correction sur `docs/`. Puisque la documentation n'engage plus, la laisser dériver devient moins coûteux, et le risque est de valider une dégradation lente sous couvert de l'avoir anticipée. C'est pourquoi la règle impose la correction de la doc, et pas seulement de l'ignorer.

Les contradictions connues ne disparaissent pas du repo pour autant. Elles restent lisibles, et un lecteur qui ignore cette décision peut toujours appliquer une information fausse. Les écarts identifiés sont recensés dans la section « Points ouverts » de `docs/README.md` plutôt que corrigés à la volée, pour qu'ils soient traités comme des tâches et non oubliés.
