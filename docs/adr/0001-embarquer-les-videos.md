# ADR 0001 — Embarquer les vidéos, ne jamais les héberger

- Date : 2026-08-14
- Statut : accepté

## Contexte

Unkast est une plateforme de découverte de talents par leur travail : le film est l'objet central, chaque profil et chaque page projet en affiche un. La question de savoir où vivent ces fichiers vidéo se posait dès la conception, avant l'écriture de la première page.

Le public visé (professionnels du cinéma et de l'audiovisuel français) dispose déjà de ses films en ligne, sur Vimeo pour l'essentiel et sur YouTube pour le reste. Ce sont des plateformes qu'ils maîtrisent, où leurs oeuvres sont déjà référencées, versionnées et parfois protégées par mot de passe.

## Décision

Unkast n'héberge aucun fichier vidéo. Un projet stocke une URL Vimeo ou YouTube dans `projects.video_url`, et le rendu passe exclusivement par le composant partagé `src/components/VideoEmbed.tsx`, wrapper SSR-safe de `react-player`.

Toute évolution du besoin vidéo (nouveau fournisseur, nouveau mode de lecture, façade de chargement) se traite dans `VideoEmbed` et `VideoFacade`, jamais par l'ajout d'un stockage de fichiers.

## Raison

L'hébergement vidéo natif a été écarté. Il aurait imposé, dès le premier utilisateur, une chaîne complète de transcodage, de stockage, de CDN et de lecture adaptative, c'est à dire le poste de coût et de complexité le plus lourd du produit, pour résoudre un problème que les créateurs ont déjà résolu de leur côté.

L'embed retourne aussi le rapport de force sur les droits : le fichier reste chez son auteur, sur son compte, sous son contrôle. Unkast ne devient jamais dépositaire d'oeuvres qui ne lui appartiennent pas, ce qui évite d'avoir à construire une politique de rétention, de suppression et de réponse aux réclamations avant même d'avoir un produit.

Enfin, la restriction à deux fournisseurs est délibérée. Accepter n'importe quelle URL aurait transformé `VideoEmbed` en boîte à cas particuliers et ouvert une surface d'injection sur une donnée fournie par l'utilisateur.

## Conséquences

`react-player` devient une dépendance structurelle : `VideoEmbed` est un composant critique consommé par `ProfileClient` et `ProjetClient`, les deux pages qui portent la proposition de valeur. Une régression de ce composant casse le coeur du produit, pas une fonctionnalité périphérique.

L'inconvénient accepté est une perte de contrôle réelle sur la disponibilité et le rendu. Si un créateur supprime sa vidéo, la rend privée ou change ses réglages d'intégration, la page projet Unkast se dégrade sans que le code puisse rien y faire, et sans que la base le sache. Unkast subit également l'interface, les préchargements et la politique de confidentialité des lecteurs tiers, sans pouvoir imposer sa propre identité visuelle sur la surface la plus regardée de l'application.

Corollaire assumé : aucune donnée de lecture exploitable. Le nombre de vues, la durée regardée et le taux de complétion appartiennent à Vimeo et YouTube. Une métrique d'engagement sur les films est hors de portée tant que cette décision tient.
