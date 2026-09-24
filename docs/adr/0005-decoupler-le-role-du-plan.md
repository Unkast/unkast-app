# ADR 0005 — Découpler le rôle du plan

- Date : 2026-08-14
- Statut : accepté

## Contexte

Deux notions coexistent sur `profiles` : `account_type`, qui dit ce que la personne fait sur la plateforme (`talent`, `creator`, `recruiter`), et `plan`, qui dit ce qu'elle a payé (`free`, `pro`).

Elles ont d'abord été liées. L'approbation d'un recruteur par l'administration accordait le Pro, sur l'idée qu'un recruteur validé est par nature un utilisateur avancé. Le badge « Vérifié » suivait la même logique et dépendait du rôle.

Ce couplage a produit des situations sans solution propre : révoquer l'approbation d'un recruteur devait-il retirer un Pro par ailleurs payé ? Un recruteur ayant souscrit chez Stripe puis perdu son approbation se retrouvait dans un état que ni le webhook ni l'administration ne savaient décrire.

## Décision

`account_type` et `plan` sont indépendants. La règle `recruiter ⇒ pro` n'existe plus : `approve_recruiter` ne modifie plus le plan, et le badge « Vérifié » dépend du plan, pas du rôle.

Un rôle décrit un usage et se gagne par l'approbation. Un plan décrit un droit commercial et se gagne par un paiement Stripe ou par un grant administrateur (voir [ADR 0006](0006-webhook-stripe-souverain.md)). Aucun des deux ne se dérive de l'autre.

Le type de grant `recruiter`, devenu sans objet, a été retiré du modèle.

## Raison

Le maintien du couplage a été écarté parce qu'il faisait porter à une seule colonne deux cycles de vie sans rapport. L'approbation d'un recruteur est un jugement de modération, révocable à tout instant sur critère humain ; un abonnement est un contrat, avec une échéance et un tiers payeur. Les faire dépendre l'un de l'autre garantissait des états incohérents dès la première révocation.

Le déclencheur concret est le passage à un modèle de monétisation réel. Tant que le Pro était surtout symbolique, l'offrir aux recruteurs était sans conséquence. Dès lors qu'il se vend, en offrir un exemplaire par un chemin de modération revient à percer le mur de paiement par une porte que personne ne surveille.

Le rattachement du badge « Vérifié » au plan plutôt qu'au rôle découle du même raisonnement : le badge est une contrepartie commerciale, il doit suivre ce qui est payé.

## Conséquences

Les deux notions doivent désormais être vérifiées séparément partout où elles comptent, et il n'existe plus de raccourci du type « c'est un recruteur, donc il a le Pro ». Le code d'autorisation est donc un peu plus verbeux, et une vérification oubliée ne sera plus rattrapée par l'autre.

Les recruteurs qui bénéficiaient implicitement du Pro par leur approbation le perdent, sauf grant explicite. C'est une régression fonctionnelle réelle pour ces comptes, assumée au profit de la cohérence du modèle, et elle a nécessité un backfill des Pro existants au moment de la bascule.

Le découplage déplace enfin une charge vers l'administration : ce que le rôle accordait automatiquement doit maintenant être décidé cas par cas via un grant. C'est plus de travail manuel, en échange d'une intention explicite et traçable à chaque octroi.
