# Mise en ligne : gestion des films (Responsable, co-gestionnaires, droits)

> Liste de controle pour Maxime. Version du 08/10/2026, a jour des lots 2 et 3.
> Aucun parcours de l'etape 4 n'a ete execute : le code a ete verifie par les types, ESLint et
> le build, la migration par une base locale jetable. Cette liste est le premier vrai test.
>
> **Beta en cours** : la production tourne sur la branche `release/beta` (commit `67ce9b8`,
> base sans la migration). `main` ne doit pas partir en production avant l'etape 2.
> Migration : `supabase/migrations/20261008_film_management.sql`
> Rollback : `supabase/migrations/20261008_film_management_rollback.sql`

L'ordre compte. Entre l'etape 2 et l'etape 3, l'app en ligne ne peut plus publier de film
(l'ancien code insere directement dans `projects`, ce que la migration interdit). Enchainer
les deux sans pause, a une heure creuse.

## 1. Avant

- [ ] Build local OK et ESLint sans nouvelle erreur sur le commit a deployer.
- [ ] Les commits sont pousses (accord explicite de Maxime).
- [ ] Verification 1 en tete de la migration : `0` profil avec `pro_grant_type = 'recruiter'`.
- [ ] Verification 2 en tete de la migration : noter les films publics sans credit de
      realisation (ils n'afficheront aucun nom de realisateur apres la mise en ligne).
- [ ] Aucun film sans Responsable et aucun doublon de `video_key` en attente d'un rollback
      precedent (les deux requetes sont en tete du fichier de rollback).

## 2. Migration (SQL Editor, a la main)

- [ ] Executer `20261008_film_management.sql` en entier. Elle est dans une seule transaction :
      une erreur annule tout.
- [ ] Verification 1 apres execution : films approuves restes sans `video_key`
      (URL non reconnue, ou meme video qu'un autre film : rien n'a ete ecrase).
- [ ] Verification 2 : nombre de policies par table conforme a la liste du fichier.
- [ ] Verification 3 : `anon` n'a plus que SELECT sur les tables listees.
- [ ] Verification 4 : test du trigger en role `authenticated` (cas a, b, c un par un).

## 3. Deploiement

- [ ] Vercel, Settings, Environments, Production : remettre la branche de production sur `main`.
- [ ] Deployer `main` sur Vercel immediatement apres la migration.
- [ ] Reporter sur `main` les correctifs faits sur `release/beta` pendant la beta, s'il y en a.
- [ ] Ouvrir https://app.unkast.com : feed, une page projet, une page profil s'affichent.

## 4. Parcours a tester en production

Avec deux comptes de test (A et B), plus le compte admin.

- [ ] **Publier** (A) : le formulaire exige le role declare et la case des droits. Pour une
      publicite ou un clip, la case « client ou label » est exigee en plus. Une video privee
      ou protegee par mot de passe est refusee. Le film arrive en attente dans l'admin, avec
      le titre et la chaine d'origine.
- [ ] **Doublon** (B) : publier la meme video que A. Pas d'erreur seche : trois choix
      (demander a etre credite, demander a co-gerer, revendiquer). Si le film de A est encore
      en attente, son titre n'apparait pas.
- [ ] **Admin** : approuver le film de A, refuser un film de test. Un film refuse libere sa
      video : elle peut etre republiee par un autre compte.
- [ ] **Modifier** (A) : changer le titre d'un film approuve. Le film reste en ligne et
      apparait dans « modifies recemment » cote admin. Sur un film anterieur a la migration,
      la declaration de droits est demandee a la premiere modification.
- [ ] **Inviter un co-gestionnaire** (A) : crediter B, l'inviter a co-gerer, B accepte. B peut
      modifier les infos et l'equipe, mais ne voit ni « Depublier » ni « Supprimer ».
- [ ] **Demande de co-gestion** (B) : sur un autre film ou B est credite, demander a co-gerer ;
      A accepte ou refuse.
- [ ] **Visibilite** (A) : trois choix, avec l'avertissement sur les festivals a cote.
      « Membres seulement » : en navigation privee, le film est absent du feed et de la
      recherche et sa page renvoie une 404 ; connecte avec un profil approuve, il est visible ;
      le code source de la page porte `noindex`. « Depublie » : seuls A et B le voient, dans
      /moi. Repasser en public le fait revenir partout.
- [ ] **Parcours** (A) : ajouter une entree (titre, role, annee, type, production). Elle
      apparait sur le profil public, dans une section separee de « Films », sans lien ni image.
      Un lien, un email ou un numero de telephone est refuse avec un message clair. La 31e
      entree est refusee. Un autre membre peut la signaler.
- [ ] **Transferer** (A) : transferer le film a B. B devient Responsable, A co-gestionnaire.
- [ ] **Signaler / revendiquer** (un troisieme compte non credite) : la demande arrive dans
      l'admin avec son justificatif.
- [ ] **Plafond** : la jauge de /moi ne compte que les films dont on est Responsable.
- [ ] **Nom du realisateur** : sur le feed et la page projet, il vient du credit de
      realisation, pas du Responsable.
- [ ] **Visiteur non connecte** (navigation privee) : sur une page projet, le realisateur
      apparait en clair avec le lien vers son profil ; le reste de l'equipe en initiales,
      sans lien. Connecte, les noms complets reviennent.
- [ ] **Annuler une demande de credit** en attente : elle disparait vraiment.
- [ ] **Pages profil, feed, recherche** : elles s'affichent (les lectures liant profils et films
      ont ete qualifiees pour la nouvelle table des co-gestionnaires ; c'est le point a verifier
      en premier, une erreur ici donne des pages profil introuvables).
- [ ] **Passage en publicite ou en clip** (A) : modifier la categorie d'un film publie dans une
      autre categorie. La case « client ou label » est exigee ; B, co-gestionnaire, est refuse.
- [ ] **Annuler une invitation ou une demande de co-gestion** en attente : son auteur le peut,
      depuis le panneau Gestion de /moi ou la page du film.
- [ ] **Invitation a co-gerer recue** (B) : elle apparait en haut de « Mes films », avec
      Accepter et Refuser.
- [ ] **Publication par un talent et par un recruteur** : l'onglet « Mes films » leur est ouvert.
- [ ] **Coordonnees** : un email ou un numero dans la bio, le Parcours ou la description d'un
      film est refuse avec le renvoi vers la section Contact. Un cas douteux (« insta » seul)
      est enregistre et arrive dans l'onglet Signalements de l'admin, motif « Coordonnees ».
      Dans les 3 premiers messages d'une conversation, meme controle.
- [ ] **Admin, revendication** : accepter une revendication propose d'attribuer le film au
      demandeur ; rien n'est transfere sans ce second clic.
- [ ] **Admin, films** : sections « A valider » (titre et chaine d'origine, role declare),
      « Modifies recemment » (bouton Vu), « Sans Responsable » (attribution par recherche).
- [ ] **Inscription d'un createur avec un film** : role et declaration exiges ; si la video est
      deja sur Unkast, privee, ou la declaration manquante, le compte est cree et un message
      explique pourquoi le film ne l'est pas.

## 5. En cas de probleme

- Bug d'affichage ou de parcours : corriger et redeployer, la base reste en place.
- Blocage serieux : redeployer la version precedente sur Vercel, PUIS executer le rollback.
  Le rollback supprime co-gestionnaires, declarations de droits, demandes et revendications
  crees entre-temps, et echoue volontairement s'il existe un film sans Responsable.
