# ADR 0014 — Séparer le Responsable d'un film de ses co-gestionnaires et de son générique

- Date : 2026-10-08
- Statut : accepté

## Contexte

Un film avait un seul propriétaire, `projects.profile_id`, et cette colonne portait quatre sens à la fois : qui a publié, qui a les droits, qui peut modifier, et quel nom s'affiche comme auteur du film. Elle ne permettait ni qu'un producteur et un réalisateur gèrent le même film, ni qu'un film survive au départ de celui qui l'avait mis en ligne. La publication était réservée aux comptes « créateur », alors qu'un producteur inscrit comme recruteur a tout autant de films à montrer.

Plusieurs règles ne tenaient que par les routes API. Le relevé de production du 08/10/2026 a montré qu'un client pouvait insérer directement dans `projects` en contournant le plafond et l'anti-doublon, inviter sur le film d'un autre, ou lire l'équipe d'un film non publié.

## Décision

Un film a **un Responsable unique** (`projects.profile_id`) et des **co-gestionnaires** (`project_managers`). Le Responsable seul retire le film, change sa visibilité et le transfère. Les co-gestionnaires modifient les informations, l'équipe et les crédits.

La publication est ouverte à tout membre. Elle exige un **rôle déclaré** et une **déclaration de droits** datée et versionnée, complétée par l'accord du client ou du label pour une publicité ou un clip.

Le **nom du réalisateur** vient des crédits de réalisation du film, jamais du Responsable. Un film sans crédit de réalisation n'affiche aucun nom.

La **création d'un film passe par une seule fonction**, `publish_project`, réservée au service role. Les clients n'ont plus d'INSERT sur `projects` ; leur UPDATE est limité par GRANT à cinq colonnes, et un trigger garde le reste.

Un doublon de vidéo n'est pas une impasse : la personne peut demander à être créditée, à co-gérer, ou revendiquer le film auprès de l'administration.

## Raison

Trois modèles ont été écartés.

Des **copropriétaires égaux** : chacun aurait pu retirer le film des autres, et le plafond de films n'aurait plus eu de titulaire clair. Un Responsable unique donne toujours une réponse à « qui décide » et « à qui compte ce film ».

Le **propriétaire comme auteur** : c'est l'état d'avant. Il attribuait le film d'un réalisateur au producteur qui l'avait mis en ligne, et rendait tout transfert visible comme un changement d'auteur.

Les **règles dans les routes seules** : c'est ce qui a produit les failles relevées. La base est le dernier rempart parce que la clé publique permet de lui parler sans passer par les routes ([ADR 0004](0004-echouer-ferme-par-defaut.md)). Les règles qui demandent plusieurs écritures cohérentes (plafond, doublon, déclaration, crédits) vivent dans une fonction transactionnelle plutôt que dans une suite d'appels qu'une course peut entrelacer.

Le trigger de garde reprend le modèle de `guard_profiles_system_columns` (SECURITY INVOKER, laisse passer les rôles `BYPASSRLS`) pour qu'il n'y ait qu'une seule façon de protéger des colonnes dans ce dépôt.

## Conséquences

Les films antérieurs n'ont pas de déclaration de droits : elle est demandée au Responsable à sa prochaine modification. Aucun crédit de réalisation n'est créé rétroactivement, donc un film ancien sans ce crédit perd son nom d'auteur à l'affichage.

Un film peut exister sans Responsable : à la suppression du compte, il passe au co-gestionnaire le plus ancien, sinon il est dépublié et listé dans l'administration, qui lui en attribue un.

Toute lecture faite avec le service role contourne les policies et doit appliquer elle-même le filtre de visibilité. C'est un point de vigilance à chaque nouvelle route.

Accepter une revendication ne transfère rien : l'administration attribue le film dans un second geste, sans contrôle du plafond.

La migration et le code ne sont pas rétrocompatibles : l'ancien code ne publie plus sur la nouvelle base, le nouveau ne publie pas sur l'ancienne. La mise en ligne enchaîne les deux ([liste de contrôle](../mise-en-ligne-gestion-films.md)).

Reste hors de ce chantier : demande de transfert avec arbitrage, historique des actions sensibles, notifications à tous les gestionnaires (phase 2) ; fusion de doublons par l'administration, bandes démo appartenant au talent, contrôle périodique des vidéos supprimées (après lancement).
