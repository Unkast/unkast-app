# ADR 0012 — Imposer un dark mode exclusif

- Date : 2026-08-14
- Statut : accepté

## Contexte

Unkast présente des films. Les surfaces les plus regardées du produit, la page projet et la page profil, sont construites autour d'un lecteur vidéo, et le reste de l'interface entoure cette image.

La direction artistique a été fixée avant la première page, en même temps que le reste des spécifications : fond `#0d0d0d`, cartes `#141414`, accent lime `#C8FF00`, accent secondaire teal `#00D4AA`, et une couleur par catégorie de projet.

## Décision

Le produit n'a qu'un seul thème, sombre. Pas de thème clair, pas de bascule, pas de suivi de la préférence système.

La palette est fixée et partagée : les couleurs et libellés de catégories vivent dans `src/lib/constants.ts`, et la coque native s'y aligne (`StatusBar` en style `DARK` sur `#0d0d0d` dans `capacitor.config.ts`).

## Raison

Le double thème a été écarté. Il double la surface de vérification visuelle de chaque écran, impose une abstraction par variables de thème sur toutes les couleurs, et n'apporte rien à un produit dont le sujet est l'image projetée.

Le fond sombre est le choix qui sert le contenu : il fait disparaître l'interface autour de la vidéo au lieu de la concurrencer, et c'est la convention du domaine, des salles aux outils de montage. Un thème clair aurait affaibli la seule chose que l'utilisateur est venu regarder.

L'unicité du thème permet enfin de traiter la couleur comme un porteur de sens plutôt que comme une décoration. L'accent lime signale l'action, le teal signale la disponibilité, et chaque catégorie a sa teinte propre : ce codage n'aurait pas survécu à une transposition en clair sans être repensé entièrement.

## Conséquences

La décision est difficile à annuler. Les couleurs sont posées en dur dans les composants plutôt que derrière des variables de thème, ce qui est cohérent tant qu'il n'y a qu'un thème mais transforme tout ajout ultérieur d'un mode clair en refonte transverse de l'interface. C'est le coût accepté du choix.

Elle exclut les utilisateurs qui lisent mal sur fond sombre, et ceux qui utilisent Unkast en pleine lumière, sans leur laisser d'échappatoire. Le produit ne respecte pas non plus la préférence système, ce qui reste un écart aux attentes courantes.

Les contrastes doivent enfin être surveillés : la hiérarchie de texte descend jusqu'à `#555555` sur fond `#0d0d0d`, un niveau tertiaire qui frôle les seuils d'accessibilité et qui peut devenir illisible selon l'écran et l'environnement.

Contexte reconstruit depuis le repo, non issu d'une délibération tracée. À corriger si l'arbitrage réel a différé.
