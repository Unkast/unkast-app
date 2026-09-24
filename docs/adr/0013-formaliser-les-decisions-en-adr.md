# ADR 0013 — Formaliser les décisions structurantes en ADR, distinctes des règles

- Date : 2026-08-14
- Statut : accepté

## Contexte

CLAUDE.md concentrait à la fois les règles applicables au projet et les décisions qui les avaient produites, sans distinguer les deux. Le fichier disait quoi faire, jamais pourquoi.

Les conséquences étaient visibles. Les arbitrages réels n'étaient nulle part : ni le renoncement à l'hébergement vidéo, ni le découplage du rôle et du plan, ni le choix de faire primer le code sur la documentation n'existaient ailleurs que sous forme de règle sèche ou de message de commit. Une règle sans sa raison ne se discute pas, elle se subit ou se contourne, et personne ne peut savoir si le contexte qui l'a justifiée tient encore.

Le repo ne contenait aucun ADR, ni sous ce nom ni sous une autre forme : la recherche sur l'ensemble des fichiers versionnés n'a rien retourné.

## Décision

Les décisions structurantes et durables sont formalisées en ADR dans `docs/adr/`, numérotés séquentiellement depuis 0001, sur le modèle de `docs/adr/0000-template.md`.

Un ADR n'est créé que pour un arbitrage, c'est à dire une décision qui a écarté une alternative identifiable. Une procédure de travail, une consigne opérationnelle et un fait sans arbitrage n'en sont pas et restent dans CLAUDE.md.

L'ADR ne remplace pas la règle, il la double. La règle applicable reste dans CLAUDE.md, où elle est lue avant chaque tâche ; l'ADR porte le contexte, l'alternative écartée et les conséquences, et n'est consulté que lorsque la règle est remise en question.

Toute section « Conséquences » nomme au moins un inconvénient réellement accepté. Un ADR qui ne liste que des bénéfices n'a pas fait son travail.

Quand le contexte d'une décision antérieure n'est pas tracé dans le repo, il est reconstruit uniquement à partir de ce qui est vérifiable, et le fichier porte en fin de document la mention « Contexte reconstruit depuis le repo, non issu d'une délibération tracée ». Une raison ou une conséquence ne s'invente jamais.

## Raison

Deux alternatives ont été écartées.

Tout concentrer dans CLAUDE.md a été rejeté parce que c'était l'état de départ, et qu'il avait déjà échoué : aucun des arbitrages du projet n'y survivait. Le fichier est lu avant chaque modification de code, ce qui impose qu'il reste court et impératif ; y ajouter le raisonnement de chaque décision l'aurait rendu illisible pour son usage principal.

Déplacer les règles dans les ADR a été rejeté pour la raison inverse. CLAUDE.md aurait perdu son rôle de référence opérationnelle, et appliquer une règle aurait supposé de lire treize fichiers avant chaque tâche. La duplication assumée entre règle et ADR est le prix de la lisibilité des deux.

Le critère « un arbitrage avec une alternative écartée » a été retenu parce que c'est le seul qui résiste à l'usage. Sans lui, toute consigne finit par devenir un ADR, le dossier gonfle, et le format perd ce qui en fait la valeur : dire ce qui a été refusé, pas seulement ce qui a été retenu. Ce critère a servi à écarter la section « Consultation obligatoire de la documentation », la « Classification des risques » et la stack technique, qui sont des procédures ou des faits.

L'exigence d'un inconvénient nommé répond au biais principal du format : un ADR écrit après coup justifie naturellement la décision prise. Forcer l'énoncé du coût rend le document utilisable pour décider de revenir en arrière, pas seulement pour se donner raison.

La mention de contexte reconstruit répond au même risque, appliqué à la rétro-documentation. Douze des treize ADR de ce dossier ont été écrits après les décisions qu'ils décrivent ; sans marquage, rien ne distinguerait une délibération réelle d'une reconstruction plausible, et la fausse mémoire serait indétectable.

## Conséquences

Règle et raison vivent dans deux fichiers, et peuvent diverger. Modifier une règle dans CLAUDE.md sans toucher l'ADR correspondant produit une contradiction que rien ne détecte, et c'est presque toujours l'ADR, moins lu, qui restera en arrière. C'est l'inconvénient central de cette décision, et il est de même nature que celui qui touche déjà `docs/` (voir [ADR 0009](0009-le-code-prime-sur-la-documentation.md)).

Le dossier ajoute une charge à chaque décision structurante : il faut reconnaître qu'on en prend une, identifier l'alternative écartée, et écrire un document que personne ne lira peut-être jamais. Sur un projet à un développeur, cette charge est réelle et sera parfois sautée.

Le format est enfin plus fragile qu'il n'en a l'air. Le critère de tri suppose un jugement à chaque fois, et deux cas limites de cette session (migrations manuelles, primauté du code) ont d'abord été classés hors périmètre avant d'être rapatriés en [ADR 0008](0008-migrations-sql-manuelles.md) et [ADR 0009](0009-le-code-prime-sur-la-documentation.md), pour cohérence avec un autre repo. La frontière entre procédure et arbitrage n'est donc pas nette, et se décide aussi au niveau du portefeuille de projets, pas du seul repo courant.

Un ADR obsolète ne se supprime pas. Le champ Statut permet de le marquer remplacé ou abandonné, ce qui veut dire que le dossier ne fera que grossir, y compris de décisions qui ne s'appliquent plus. C'est voulu, l'historique des arbitrages abandonnés ayant sa propre valeur, mais cela dégrade la lisibilité du dossier avec le temps.
