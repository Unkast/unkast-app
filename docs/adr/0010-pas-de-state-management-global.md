# ADR 0010 — Se passer de state management global

- Date : 2026-08-14
- Statut : accepté

## Contexte

Unkast est construit sur l'App Router de Next.js, où l'essentiel des pages sont des Server Components qui lisent Supabase directement au rendu : le feed, les pages profil, projet et catégories récupèrent leurs données côté serveur et les passent en props à un composant client.

L'état réellement partagé entre écrans est donc réduit. Ce qui aurait pu justifier un store global, la session et le profil courant, est déjà porté ailleurs : par les cookies Supabase rafraîchis dans le proxy, et par les gardes serveur.

## Décision

Pas de bibliothèque de state management global. Ni Zustand, ni Redux, ni Context React à l'échelle de l'application.

L'état vit en `useState` local dans le composant qui l'utilise. Les deux seuls états transverses sont encapsulés dans des hooks custom, `useUserStatus` pour le statut freemium du visiteur et `usePushNotifications` pour l'enregistrement natif, chacun chargeant son SDK par import dynamique.

## Raison

Ajouter un store global a été écarté au titre de l'échelle de minimalisme appliquée au projet : la plateforme rend déjà ses données côté serveur, et un store aurait dupliqué en mémoire cliente ce que le serveur fournit à chaque navigation.

Le coût d'un store n'est pas seulement sa dépendance. Il appelle une convention de découpage, une discipline de sélecteurs, et il attire progressivement des données qui devraient rester dans le serveur, jusqu'à créer une seconde source de vérité côté client. Sur un produit à un seul développeur, cette structure coûte plus qu'elle ne rapporte tant que le besoin ne s'est pas manifesté.

L'encapsulation des deux cas transverses dans des hooks est le compromis retenu : elle donne la réutilisation sans introduire de conteneur d'état partagé.

## Conséquences

`useUserStatus` refait son travail à chaque montage. Plusieurs composants affichés simultanément et dépendant du statut déclenchent chacun leur lecture de `auth.getUser()` puis de `profiles.plan`, sans mise en cache ni déduplication. C'est une redondance réseau acceptée, qui deviendra visible si le nombre de surfaces dépendant du plan augmente.

Aucun mécanisme ne synchronise deux composants montés en parallèle. Si l'un modifie une donnée que l'autre affiche, le second reste sur son état jusqu'à sa prochaine navigation ou son prochain montage. Les incohérences d'affichage de ce type sont possibles par construction, et se corrigent au cas par cas.

La décision se paie enfin en remontée d'état. Faire circuler une donnée entre composants éloignés impose de la faire transiter par les props ou de la relire, ce qui alourdit les composants clients les plus gros. Elle tient tant que l'application reste majoritairement rendue côté serveur ; une bascule significative vers du client interactif la remettrait en cause.

Contexte reconstruit depuis le repo, non issu d'une délibération tracée. À corriger si l'arbitrage réel a différé.
