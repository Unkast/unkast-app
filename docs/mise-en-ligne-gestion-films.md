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

> `20261008_film_management.sql` est deja executee en production. Pour le lot « corrections
> beta », executer `20261009_film_limit_and_edit_watch.sql` juste avant de deployer son code
> (rollback : `20261009_film_limit_and_edit_watch_rollback.sql`), puis ses deux verifications.

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
- [ ] **Signaler** (un troisieme compte non credite) : un seul bouton sur la page du film, deux
      choix. « Un probleme avec ce film » arrive dans l'onglet Signalements de l'admin ;
      « Je detiens les droits de ce film » arrive dans l'onglet Revendications avec son
      justificatif.
- [ ] **Films lies** (navigation privee) : sur la page d'un film public qui partage une personne
      creditee avec un autre film public, la section des films lies n'est pas vide.
- [ ] **Role du titulaire** (navigation privee) : sur un profil, le role de la personne sur ses
      propres films apparait en clair ; le reste de l'equipe reste en initiales.
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

## 4 bis. Lot « corrections beta »

- [ ] **Jauge** (compte gratuit) : « n sur 3 ». Un film depublie ou refuse libere une place ;
      un film en attente en prend une. Compte Pro : pas de jauge, « illimite ».
- [ ] **Remise en ligne** : compte gratuit avec 3 films en ligne et 1 depublie, repasser le
      depublie en public est refuse avec un message clair.
- [ ] **Lien video** : aucun champ pour le modifier dans « Modifier » ; la phrase renvoie vers
      la publication d'un nouveau film.
- [ ] **Admin, « Modifies recemment »** : corriger une faute dans un titre ne fait rien
      apparaitre ; remplacer le titre fait apparaitre le film avec le titre valide ; « Vu » le
      retire.
- [ ] **Admin mobile** : pastilles des onglets visibles des l'ouverture ; carte « Approuves » de
      l'onglet Recruteurs lisible ; pas de barre de defilement sous les onglets.
- [ ] **Noms** : un compte en nom de scene n'affiche son vrai nom nulle part pour un autre
      membre (equipe d'un film, messagerie, recherche, invitations, notifications). Sur sa page
      profil, le vrai nom n'est pas dans le code source de la page.

## 4 ter. Lot « image du film + films membres »

Executer `20261010_film_poster_and_member_teasers.sql` (apres celle du 9) juste avant de
deployer, puis ses trois verifications.

- [ ] **Vignette automatique** : publier un film YouTube, puis un film Vimeo. Chacun a son image
      dans « Mes films », sur le feed et sur sa page, sans rien envoyer.
- [ ] **Films existants** : admin, onglet Films, « Recuperer les images manquantes ». Le message
      donne le nombre d'images recuperees ; les films concernes ont maintenant une image.
- [ ] **Image envoyee** (Responsable, puis co-gestionnaire) : panneau Image, choisir une photo,
      recadrer en 16:9, valider. L'image change partout. Un fichier de plus de 5 Mo ou d'un autre
      format est refuse avec un message clair.
- [ ] **Revenir a l'image de la video** : le bouton n'apparait que sur une image envoyee ; la
      vignette revient.
- [ ] **Pas de suivi** : changer l'image ne fait rien apparaitre dans « Modifies recemment ».
- [ ] **Film membres, navigation privee, lien direct** : carte verrouillee (image floutee,
      cadenas, titre, « Reserve aux membres. Inscris-toi pour voir ce film. », bouton vers
      l'inscription). Dans le code source de la page : ni lien YouTube / Vimeo, ni description,
      ni nom de l'equipe. La page porte `noindex`.
- [ ] **Deja membre** : sur la page verrouillee, « Deja membre ? Connecte-toi » mene a la
      connexion, puis ramene sur le film (par mot de passe et par Google).
- [ ] **Film membres, navigation privee, fiche du Responsable** : la meme carte dans sa liste de
      films. Connecte, le film s'affiche normalement, sans carte verrouillee.
- [ ] **Film depublie** : toujours introuvable pour un visiteur, aucune carte.

## 4 quater. Lot « admin rapide »

Avant de deployer :
- [ ] Executer `20261011_film_refusal_reasons.sql`, puis ses deux verifications.
- [ ] Vercel, Settings, Environment Variables, Production : ajouter `ADMIN_ALERT_EMAIL` avec
      l'adresse qui doit recevoir les alertes. Sans elle, aucune alerte ne part (et rien ne casse).
      Redeployer apres l'ajout : une variable n'est lue qu'au deploiement suivant.

A tester, sur telephone :
- [ ] **Alerte** : publier un film avec un compte de test. Un email « Film a valider » arrive a
      l'adresse d'alerte ; son bouton ouvre l'admin directement sur l'onglet Films.
- [ ] **Carte de validation** : le lecteur se lance dans la carte ; titre et chaine d'origine,
      role declare, categorie et duree (Vimeo seulement) sont lisibles sans faire defiler de
      cote ; « Approuver » et « Refuser » se touchent au pouce.
- [ ] **Refuser** : les motifs se deplient dans la carte, plusieurs se cochent ; « Autre » demande
      un texte ; « Confirmer le refus » reste grise sans motif.
- [ ] **Message recu** (compte de test) : l'email de refus arrive avec les motifs choisis ; la
      notification arrive sur le telephone ; dans « Mes films », la carte du film refuse affiche
      les motifs.
- [ ] **Approuver apres un refus** : le motif disparait de « Mes films ».
- [ ] **Chronometre** : un film valide en moins de 30 secondes, de l'email d'alerte au clic sur
      « Approuver ».

## 4 quinquies. Lot « pages legales beta »

Avant de deployer :
- [ ] Executer `20261012_terms_acceptance.sql`, puis ses verifications 1 et 2.
- [x] **Informations de la societe** remplies dans `src/lib/legal.ts` le 09/10/2026 (JMB Vision
      FZCO). Plus aucun champ entre crochets sur les trois pages.
- [x] Textes relus : Pro offert jusqu'au 1er fevrier 2027 confirme ; adresse de Vercel verifiee
      sur vercel.com le 09/10/2026. Les pages s'adressent a des membres du monde entier.
- [ ] Deux regles ajoutees par proposition restent a valider : contenus sexuels explicites
      interdits, interdiction de demander de l'argent pour un casting ou une mise en relation.
- [ ] Creer la boite `contact@unkast.com` et verifier qu'elle est relevee : les demandes de
      suppression de compte y arrivent, avec un delai de 30 jours annonce.

A tester :
- [ ] Les trois pages s'ouvrent sans etre connecte, depuis le pied de page de l'accueil, de la
      connexion et de l'inscription, et depuis l'onglet Compte de /moi.
- [ ] **Inscription** : impossible de creer un compte sans cocher la case. Apres inscription, la
      verification 3 de la migration montre la version et une ligne de plus.
- [ ] **Inscription par Google** : l'acceptation est bien enregistree (ecran d'acceptation a la
      premiere page, ou directement).
- [ ] **Membre deja inscrit** : a la connexion, l'ecran « Les CGU ont ete mises a jour » bloque
      l'app jusqu'a l'acceptation ; les trois pages restent lisibles ; « Me deconnecter » marche.
      Une fois accepte, l'ecran ne revient pas.
- [ ] **Videos** : en navigation privee, outils du navigateur ouverts sur l'onglet Reseau, ouvrir
      le feed, une fiche et une page de film : aucune requete vers youtube.com, youtube-nocookie.com
      ni vimeo.com avant de cliquer sur lecture. Apres le clic sur un film YouTube, le lecteur vient
      de `youtube-nocookie.com`.

## 4 sexies. Lot « inscription par Google »

Aucune migration. A tester avec un compte Google jamais utilise sur Unkast, puis avec un compte
deja finalise :
- [ ] **Nouveau compte, depuis l'inscription** : cocher la case, « Continuer avec Google ». Au
      retour, on arrive sur « Finalise ton profil », jamais sur l'etape 1 de l'inscription.
      L'ecran « Avant de continuer » ne s'affiche pas (la case etait cochee). Remplir, « Terminer » :
      on arrive sur le feed, le profil a ses metiers, et l'acceptation des CGU est enregistree.
- [ ] **Nouveau compte, depuis la page de connexion** (sans case) : au retour, l'ecran « Avant de
      continuer » demande l'acceptation, puis la finalisation.
- [ ] **Finalisation abandonnee** : fermer l'onglet sur la finalisation, revenir sur n'importe
      quelle page (feed, /moi, un film) : on est ramene a la finalisation. Les trois pages legales
      et la deconnexion restent accessibles.
- [ ] **Compte Google deja finalise** : la connexion mene directement au feed.
- [ ] **/rejoindre en etant connecte** : on arrive sur le feed (ou la finalisation), jamais sur le
      formulaire d'inscription.
- [ ] **Lien d'un film reserve aux membres, puis Google** : apres la finalisation, on revient sur
      le film.
- [ ] **Compte cree par email** : rien ne change pour lui (il a deja ses metiers).
- [ ] **Compte admin** : s'il n'a aucun metier, il passe une fois par la finalisation sur les
      pages hors admin ; l'admin reste accessible.

## Avant le lancement public (lot separe, non fait)

- [ ] **Fermer les noms reels en base.** `full_name`, `first_name` et `last_name` de `profiles`
      sont lisibles directement avec la cle publique pour tout profil approuve, meme quand la
      personne affiche un nom de scene. L'app ne les montre plus, mais la base les donne.
      A traiter : droits par colonne et nom d'affichage calcule en base.
- [ ] Refuser une demande de credit sur un film non visible.
- [ ] **Bouton « Supprimer mon compte ».** Pendant la beta, la suppression se demande par email
      (CGU et politique de confidentialite). Un bouton dans l'app est a faire avant le lancement
      public : c'est une attente du RGPD, et **une obligation de Google Play** pour toute app qui
      permet de creer un compte (suppression depuis l'app et depuis une page web).
- [ ] **Inscription recruteur par Google.** La finalisation Google ne propose que Talent et
      Createur ; un recruteur doit s'inscrire par email. A ouvrir si besoin, avec les champs
      societe et fonction et la validation admin.
- [ ] **Avis d'un juriste, representant dans l'Union europeenne.** Une societe etablie hors de
      l'Union europeenne qui s'adresse a des residents francais peut devoir designer un
      representant dans l'Union (RGPD, article 27). Le champ est prevu dans `src/lib/legal.ts`.
- [ ] **Avis d'un juriste, clause « sans garantie ».** Une clause qui exclut toute garantie a des
      limites face a des consommateurs. Faire relire les CGU (sections 1 et 10) avant le
      lancement public, ainsi que le droit applicable.
- [ ] **Durees de conservation annoncees, pas encore automatisees.** La politique promet la
      suppression des donnees 30 jours apres celle du compte, des justificatifs apres 1 an et des
      journaux techniques apres 12 mois. Rien dans le code ne le fait tout seul aujourd'hui :
      prevoir la procedure (manuelle ou planifiee), et un moyen de supprimer son compte.
- [ ] **Bandeau de cookies** : inutile tant qu'il n'y a ni mesure d'audience ni pixel
      publicitaire, et que les lecteurs video ne se chargent qu'au clic. A reconsiderer des
      qu'un tel outil est ajoute.
- [ ] **Centre de notifications dans l'app.** Aujourd'hui une personne est prevenue par email et
      par notification du telephone, et retrouve l'information dans « Mes films ». Il n'existe pas
      de liste de notifications dans l'app. A faire dans un lot separe si besoin.
- [ ] **Films ou la personne est creditee** : sa fiche ne liste que les films dont elle est
      Responsable. Les afficher aussi (et leurs cartes verrouillees) fera l'objet d'un lot separe.
- [ ] **Recherche sur le nom d'affichage.** `/api/search` filtre et trie encore sur `full_name` :
      chercher le vrai nom d'une personne la fait remonter sous son nom de scene, et on ne la
      trouve pas par son nom de scene. La recherche doit porter sur le nom d'affichage, jamais
      sur le vrai nom.
- [ ] **Adresse du profil issue du nom d'affichage.** Le `slug` (`/profil/<slug>`) est derive du
      vrai nom a l'inscription. Il doit venir du nom d'affichage, avec une solution pour les
      adresses existantes qui contiennent un vrai nom (nouvelle adresse et redirection de
      l'ancienne, ou autre : a decider).

## 5. En cas de probleme

- Bug d'affichage ou de parcours : corriger et redeployer, la base reste en place.
- Blocage serieux : redeployer la version precedente sur Vercel, PUIS executer le rollback.
  Le rollback supprime co-gestionnaires, declarations de droits, demandes et revendications
  crees entre-temps, et echoue volontairement s'il existe un film sans Responsable.
