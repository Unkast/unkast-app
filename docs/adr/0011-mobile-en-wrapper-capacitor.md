# ADR 0011 — Livrer le mobile en wrapper Capacitor par-dessus le web

- Date : 2026-08-14
- Statut : accepté

## Contexte

Unkast a d'abord été livré comme application web installable : manifeste PWA, icône, ajout à l'écran d'accueil. Cela couvrait la présence sur mobile, mais pas l'accès aux capacités natives, en particulier les notifications push, ni la présence sur le Play Store.

Le produit est par ailleurs largement rendu côté serveur, et son intérêt tient à la fraîcheur du catalogue plus qu'à une interaction hors ligne.

## Décision

Le mobile est livré comme une coque Capacitor autour du site en production. `capacitor.config.ts` pointe `server.url` sur `https://app.unkast.com` : l'application Android charge le site distant, elle n'embarque pas de bundle web.

Les capacités natives sont ajoutées par plugins ciblés (`@capacitor/push-notifications` avec FCM, `@capacitor/status-bar`, `@capacitor/camera`, `@capacitor/app`). Le code natif reste minimal, et `usePushNotifications` charge son SDK par import dynamique dans un `try/catch`, de sorte que le même code s'exécute en web sans erreur.

## Raison

Une application native distincte a été écartée. Elle aurait imposé une seconde base de code, un second cycle de livraison et une seconde implémentation de chaque règle métier, pour un produit dont le coeur reste une consultation de pages.

Rester sur la seule PWA a également été écarté, mais pour une raison précise : les notifications push. Elles sont le mécanisme de retour sur la plateforme, celui qui ramène un utilisateur quand un message arrive ou qu'un crédit est demandé, et leur support en PWA ne couvrait pas le besoin.

Le choix du `server.url` distant plutôt que d'un bundle embarqué est le point structurant. Il fait que toute livraison Vercel atteint immédiatement les utilisateurs mobiles, sans passer par une revue de store. Le cycle de release du produit reste celui du web.

## Conséquences

L'application est inutilisable hors ligne, et le restera. Sans connectivité, la coque n'a rien à afficher : il n'y a pas de contenu embarqué à présenter. C'est l'inconvénient direct et assumé du chargement distant.

Le démarrage dépend du réseau et de la latence de production. Une lenteur du site se traduit en écran vide au lancement, avec les attentes d'immédiateté propres à une application installée, plus exigeantes que celles d'un navigateur.

Le montage expose aussi le produit à la politique des stores, qui traitent avec méfiance les applications se réduisant à un site distant. Un rejet ou un durcissement des règles remettrait en cause la distribution, sans que le code puisse y répondre autrement qu'en changeant d'approche.

`android/` est enfin dans le repo mais exclu du contexte agent par `.claudeignore`, et les fichiers Kotlin ne sont modifiés que sur demande explicite. La partie native est donc peu visible dans le travail courant, ce qui réduit le risque de modification accidentelle mais rend ses régressions plus lentes à détecter.

Contexte reconstruit depuis le repo, non issu d'une délibération tracée. À corriger si l'arbitrage réel a différé.
