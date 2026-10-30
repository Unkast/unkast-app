# ADR 0017 : suppression de compte par le membre

Date : 31/10/2026 (décisions du 30/10/2026)
Statut : accepté

## Contexte

Jusqu'ici, supprimer un compte était un geste manuel dans Supabase, demandé par email (CGU et politique de confidentialité). Deux obligations imposent un parcours dans l'app : le RGPD (effacement à la demande) et Google Play (toute app qui permet de créer un compte doit permettre de le supprimer depuis l'app et depuis une page web publique).

Supprimer un utilisateur touche des données qui appartiennent aussi à d'autres personnes : films avec d'autres crédités, conversations, crédits sur les films des autres, signalements. L'audit base du 10/10/2026 (`docs/audits/2026-10-10-database.md`, section 2 et constat I4) avait relevé ce que la suppression emporte aujourd'hui.

## Décision

1. **Suppression immédiate, par le membre.** Onglet Compte de `/moi`, section discrète « Supprimer mon compte », pop-up rouge qui dit ce qui part et ce qui reste, ressaisie de l'email du compte pour confirmer (aussi pour un compte Google, sans mot de passe). Route `POST /api/account/delete`.
2. **Films.** Un film dont le membre est Responsable et la seule personne créditée est supprimé avec le compte, affiche comprise. « Seul crédité » = aucun autre crédit (un crédit sans compte, issu d'une invitation par email, compte comme une autre personne) et aucun autre co-gestionnaire (fonction `solo_projects_of`). Les autres films passent au co-gestionnaire le plus ancien ; sans co-gestionnaire, ils restent dépubliés, sans Responsable (comportement de `transfer_projects_on_profile_delete`).
3. **Crédits sur les films des autres.** Ils restent, sous le nom affiché (`display_name`, puis `full_name`, puis « Compte supprimé »), sans lien vers un compte.
4. **Conversations.** Supprimées en cascade, **chez l'autre personne aussi**. La pop-up le dit.
5. **Signalements déposés.** Gardés, sans auteur (`reports.reporter_id` en `ON DELETE SET NULL`).
6. **Stripe.** Abonnement résilié immédiatement, sans remboursement, avant toute suppression : si la résiliation échoue, rien n'est supprimé. Le client Stripe est conservé (factures, obligation comptable). La pop-up l'annonce.
7. **Compte suspendu.** Il ne se supprime pas lui-même : il reste sur la demande par email. Un compte admin est refusé (403, avant même la comparaison de l'email).
8. **Garde-fous de la route.** Compte pris de la session, jamais du body ; en-tête `Origin` contrôlé ; limite `account-delete:{id}` 5 par heure ; email confirmé par comparaison avec l'email Auth ; nettoyage du Storage et des lignes liées à l'email fait au mieux, sans jamais renvoyer d'erreur au membre ; email de confirmation après coup.
9. **Page publique `/supprimer-mon-compte`**, sans connexion, en plus des sections de `/confidentialite` et des CGU. C'est l'adresse donnée à Google Play. Liée depuis les liens légaux.
10. **`TERMS_VERSION` inchangé.** Les CGU et la politique sont corrigées sans redemander l'acceptation.

## Raison

Alternatives écartées :

- **Garder la suppression par email.** Ne satisfait ni Google Play ni l'attente du RGPD d'un parcours simple. Conservée comme voie de secours (compte suspendu, accès impossible).
- **Films : les garder tous dépubliés sans Responsable** (état d'avant). Laissait en ligne, dans l'admin, des films d'un compte supprimé qui n'a plus de raison d'être là, avec ses crédits et ses affiches. Supprimer les films où le membre est seul crédité est cohérent avec « données effacées » et ne prive personne d'autre.
- **Conversations : afficher « Compte supprimé » à la place** (participants nullables en `SET NULL`). Demande un chantier séparé (schéma, affichage, quotas) ; la cascade existante est acceptée pour ce lot.
- **Signalements : suppression en cascade** (état d'avant). Un signalement en attente est une pièce de modération : il survit à son auteur.
- **Suppression logique (profil désactivé puis effacé plus tard)**, évoquée dans l'audit du 10/10. Écartée : les données personnelles resteraient en base pendant le délai, et les sauvegardes (30 jours) couvrent déjà le besoin de rattrapage.
- **Laisser l'abonnement Stripe courir jusqu'à la fin de période.** Écartée : un compte supprimé continuerait d'être facturé sans plus pouvoir se connecter. Une résiliation qui échoue bloque la suppression pour la même raison.
- **Laisser un compte suspendu se supprimer.** Écartée : la demande passe par l'équipe, qui garde la main sur un compte sous modération.
- **Changer `TERMS_VERSION`.** Obligerait tous les membres à réaccepter les CGU pour un changement qui ne leur retire rien.

## Conséquences

- La suppression est **irréversible** : profil, films solo, conversations, fichiers. Seules les sauvegardes (30 jours) survivent, sans accès applicatif.
- Le nom du membre reste au générique des films des autres. La politique de confidentialité le dit, avec la possibilité de demander son retrait (par le membre avant la suppression, ou par email).
- **Un compte signalé pour ses messages peut effacer la preuve en se supprimant** (conversations en cascade, signalements gardés sans cible lisible). Inconvénient accepté pour ce lot ; la suppression logique ou des participants nullables le règleraient.
- Un film sans Responsable reste listé dans l'admin (`projects.profile_id is null`) pour traitement.
- Un crédit ajouté entre la lecture des films solo et la suppression garde le film : la route ne vide alors pas son dossier Storage (relecture des films restants après coup).
- Les invitations par email envoyées par le membre disparaissent avec lui ; le crédit sans compte qu'elles avaient créé reste.
- Reste hors de ce lot : durée de vie des journaux techniques (12 mois), non automatisée ; factures Stripe, conservées chez Stripe.
- Fichiers : `supabase/migrations/20261101_account_deletion.sql` (+ `_rollback.sql`), `src/app/api/account/delete/route.ts`, `src/lib/email.ts` (`sendAccountDeletedEmail`), `src/components/ConfirmDialog.tsx`, `src/app/(app)/moi/MoiClient.tsx`, `src/app/(app)/supprimer-mon-compte/page.tsx`.
