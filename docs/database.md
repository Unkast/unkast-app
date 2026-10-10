# Unkast — Base de donnees

> **Source de verite : `src/types/database.ts`** (introspecte depuis le schema reel Supabase le
> 13/06/2026). Ce fichier decrit la base **telle qu'elle existe en prod**.
>
> ⚠️ **`supabase/schema.sql` est en retard** : il ne contient encore que les **5 tables d'origine**
> et 10 colonnes sur `profiles`. Les 10 tables et ~25 colonnes ajoutees existent en prod mais ne
> sont pas dans le SQL versionne. **Chantier separe** : regenerer `schema.sql` (DDL + RLS) depuis la
> base. Ci-dessous = etat reel introspecte, pas le contenu de `schema.sql`.

## Enums

### Vrais enums Postgres (4 — les seuls reellement contraints)

| Type | Valeurs |
|---|---|
| `profile_status` | `pending`, `approved`, `rejected` |
| `project_category` | `court-metrage`, `moyen-metrage`, `long-metrage`, `publicite`, `clip`, `documentaire`, `bande-demo`, `scene-extrait`, `serie` (lot 10, migration `20261022`) |
| `contact_subject` | `collaboration`, `project`, `question`, `other` |
| `contact_status` | `pending`, `accepted`, `declined` |

### Colonnes TEXT contraintes par CHECK

Decision produit actee (migration manuelle) : `account_type` (ROLE) et `plan` sont desormais
contraints en base, independants l'un de l'autre.

| Colonne | Type TS | Valeurs autorisees | Contrainte base |
|---|---|---|---|
| `profiles.account_type` | `AccountType` | `talent` (defaut), `creator`, `recruiter`, `admin` (compte admin dedie, lot 9 : aucun droit, aucun profil public) | ✅ `profiles_account_type_check` ; bascule **talent↔creator** par l'utilisateur (`api/dashboard/profile`), `recruiter` reserve a l'admin |
| `profiles.plan` | `Plan` | `free` (defaut), `pro` | ✅ `profiles_plan_check` |

> `member` a ete supprime du modele (migre vers `talent`). `NULL` reste tolere par le CHECK (defaut
> applicatif `talent`).
>
> ⚠️ **La regle « recruiter ⇒ plan `pro` » est MORTE (2026-08-10, nouveau modele economique).** Le
> role et le plan sont desormais **totalement independants** : `approve_recruiter` n'accorde plus
> aucun Pro, il ne pose que `recruiter_status='approved'`. Un recruteur approuve peut parfaitement
> rester `free` — c'est l'etat par defaut attendu, pas une anomalie. Le Pro s'achete (Stripe) ou
> s'offre explicitement (`grant_pro`), jamais en etant approuve. Ce que l'approbation donne :
> le statut, et l'**eligibilite** au badge « verifie » (qui exige en plus `plan='pro'`, voir
> [« Badge recruteur verifie »](#badge-verifie)).

### Colonnes TEXT libres (« pseudo-enums » — AUCUNE contrainte en base)

Ces colonnes sont typees en union TypeScript **pour le confort**, mais cote Postgres ce sont des
`text` **sans `CHECK` ni `ENUM`** : n'importe quelle valeur (faute de frappe, casse, espace) passe
silencieusement. Dette technique a corriger (CHECK ou vrai enum).

| Colonne(s) | Type TS | Valeurs vues en prod / probables | Contrainte base |
|---|---|---|---|
| `profiles.recruiter_status` | `RecruiterStatus` | `pending`/`approved`/`rejected` ou `null` (null en prod) | ❌ aucune |
| `profiles.display_name_preference` | `DisplayNamePreference` | `real_name`, `stage_name` | ❌ aucune |
| `profiles.show_contact_email_to` / `show_phone_to` / `show_real_name_to` | `VisibilityAudience` | `nobody` (defaut), `pro_users`, `everyone` | ❌ aucune |
| `projects.status` | `ProjectStatus` | `pending`/`approved`/`refused` (code filtre `approved`) | ❌ aucune |
| `credit_requests.status` | `CreditRequestStatus` | `pending`/`accepted`/`declined` | ❌ aucune |
| `project_invitations.status` | `InvitationStatus` | `pending`/`accepted`/`declined` | ❌ aucune |
| `reports.status` | `ReportStatus` | `pending` (defaut), `reviewed`, `resolved`, `dismissed` | ❌ aucune |
| `waitlist.status` | `WaitlistStatus` | `pending` (defaut), `invited`, `accepted` | ❌ aucune |

## Tables (15)

### 1. profiles — 51 colonnes

| Colonne | Type | Nullable | Note |
|---|---|---|---|
| `id` | UUID | non | PK, FK → `auth.users(id)` |
| `full_name` | TEXT | non | |
| `slug` | TEXT | non | UNIQUE |
| `bio` | TEXT | oui | description. Pour un **recruteur**, c'est la **description pro VALIDÉE** (publique) ; toute modif passe par `bio_pending` (validation admin) |
| `avatar_url` | TEXT | oui | |
| `location` | TEXT | oui | |
| `is_available` | BOOLEAN | oui | defaut `false` |
| `status` | `profile_status` | oui | **vrai enum** ; defaut `pending` |
| `created_at` | TIMESTAMPTZ | oui | |
| `updated_at` | TIMESTAMPTZ | oui | trigger `profiles_updated_at` |
| `account_type` | TEXT (CHECK) | oui | ROLE : `talent` (defaut) / `creator` / `recruiter` — ✅ `profiles_account_type_check` |
| `plan` | TEXT (CHECK) | oui | `free` (defaut) / `pro` — ✅ `profiles_plan_check` |
| `pro_since` | TIMESTAMPTZ | oui | |
| `is_admin` | BOOLEAN | oui | defaut `false` — autorise l'API admin |
| `stripe_customer_id` | TEXT | oui | **chantier 7** — ID client Stripe (index unique). Clé de jointure des webhooks |
| `stripe_subscription_id` | TEXT | oui | **chantier 7** — ID de l'abonnement Stripe |
| `subscription_status` | TEXT | oui | **chantier 7** — statut Stripe brut (`active`/`trialing`/`past_due`/`canceled`/`unpaid`…) |
| `current_period_end` | TIMESTAMPTZ | oui | **chantier 7** — fin de période payée |
| `pro_source` | TEXT | oui | **GELÉE (2026-08-10)** — `'admin'` / `'stripe'` / `null`. Plus jamais écrite ni lue par le code depuis le passage au modèle grant (`pro_grant_*` ci-dessous). Conservée en base, `DROP` prévu dans un commit dédié post-lancement |
| `pro_grant_type` | TEXT (CHECK) | oui | **2026-08-10**, CHECK resserré **10/08/2026 (même jour)** — nature du Pro **offert par l'admin**, indépendant de Stripe : `'launch'` (cadeau de lancement) / `'vip'` (choix explicite) / `null` (aucun grant). ✅ `profiles_pro_grant_type_check`. Un troisième type, `'recruiter'`, a existé quelques heures le même jour puis a été retiré (voir [« Les types de grant »](#types-de-grant)) |
| `pro_grant_expires_at` | TIMESTAMPTZ | oui | **2026-08-10** — échéance du grant. Règle par nature (✅ `profiles_pro_grant_expiry_check`) : `launch` ⇒ **obligatoire** (pas de Pro à vie non voulu par oubli) ; `vip` ⇒ libre (`null` = à vie, une date reste possible pour une durée longue déterminée). Un grant expiré **n'est pas nettoyé** : les colonnes restent en base comme témoin, lues par `recompute_plan()` qui les ignore simplement |
| `pro_grant_granted_by` | UUID | oui | **2026-08-10** — FK → `profiles(id)`, admin ayant accordé le grant. `admin_logs` reste la source d'audit complète |
| `pro_grant_granted_at` | TIMESTAMPTZ | oui | **2026-08-10** — date d'octroi du grant (distincte de `pro_since`, qui marque la première acquisition Pro toutes sources confondues et n'est jamais réinitialisée) |
| `pro_grant_reminder_sent_at` | TIMESTAMPTZ | oui | **2026-08-10** — horodatage du dernier rappel J-7 envoyé **avec succès**. Ne doit être posée que si l'envoi Resend a réellement réussi — sinon le rappel est marqué envoyé sans l'avoir été et ne repart jamais. ✅ `profiles_pro_grant_reminder_check` (n'a de sens que si `pro_grant_expires_at` est renseignée) |
| `recruiter_status` | TEXT libre | oui | ⚠️ null en prod |
| `recruiter_company` | TEXT | oui | ⚠️ null en prod |
| `recruiter_role` | TEXT | oui | ⚠️ null en prod |
| `recruiter_website` | TEXT | oui | ⚠️ null en prod |
| `recruiter_document_url` | TEXT | oui | ⚠️ null en prod |
| `bio_pending` | TEXT | oui | **chantier 2** — version EN ATTENTE de la description pro (recruteur). `null` = rien en attente |
| `recruiter_verified` | BOOLEAN | non | **chantier 2** — defaut `false` ; verification d'identite accordee par l'admin. ⚠️ **Ne suffit plus a afficher le badge depuis le 10/08/2026** : le badge public exige `recruiter_verified` **ET** `plan='pro'` (voir [« Badge recruteur verifie »](#badge-verifie)) |
| `recruiter_verified_at` | TIMESTAMPTZ | oui | **chantier 2** — date d'octroi du badge (audit) |
| `recruiter_review_status` | TEXT (CHECK) | non | **chantier 2** — `none` (defaut) / `pending` / `rejected` — ✅ `profiles_recruiter_review_status_check` ; index partiel sur `pending` |
| `is_suspended` | BOOLEAN | oui | defaut `false` — **chantier 3** : effectif côté serveur (garde `getActiveUser` sur les API sensibles) **et** retrait de la vue publique (recherche/feed/profil/projet via `is_suspended IS NOT TRUE`) |
| `suspended_at` | TIMESTAMPTZ | oui | |
| `suspended_reason` | TEXT | oui | |
| `first_name` | TEXT | oui | |
| `last_name` | TEXT | oui | |
| `stage_name` | TEXT | oui | |
| `display_name_preference` | TEXT libre | oui | defaut `real_name` — ⚠️ non contraint |
| `display_name` | TEXT, **colonne générée** | non | nom d'affichage calculé par la base (migration `20261014`) : nom de scène si `display_name_preference = 'stage_name'` et rempli, sinon prénom + nom, sinon `full_name`, sinon « Utilisateur ». Jamais écrite. **Seule colonne de nom lisible par anon / authenticated** |
| `contact_email` | TEXT | oui | |
| `contact_phone` | TEXT | oui | |
| `instagram_url` | TEXT | oui | |
| `website_url` | TEXT | oui | |
| `show_contact_email_to` | TEXT libre | oui | defaut `nobody` — ⚠️ **non branché** (chantier 3 : réglages masqués dans l'UI, coordonnées non affichées publiquement ; colonne conservée) |
| `show_phone_to` | TEXT libre | oui | defaut `nobody` — ⚠️ **non branché** (idem) |
| `show_real_name_to` | TEXT libre | oui | defaut `nobody` — ⚠️ **non branché** (idem) |
| `is_recruiting` | BOOLEAN | oui | defaut `false` (badge « Je recrute ») — ecriture **reservee plan `pro` + role creator/recruiter** (gate serveur dans `api/dashboard/profile` PATCH) |
| `recruiting_roles` | TEXT[] | oui | defaut `'{}'` |
| `is_looking_for` | TEXT | oui | ⚠️ null en prod |
| `playing_ages` | TEXT[] (CHECK) | oui | **lot 8, migration `20261016`** — tranches d'âge de jeu (comédiens), 1 ou 2 parmi `18-25`, `25-35`, `35-50`, `50+`. Jamais de date de naissance. Lisible par anon et authenticated (GRANT SELECT), écrite par la personne (GRANT UPDATE) |
| `role_type` | TEXT (CHECK) | oui | **lot 8** — type de rôles joués : `femme`, `homme`, `sans_precision`. Mêmes droits |
| `languages` | TEXT[] (CHECK) | oui | **lot 8** — langues parlées, 18 codes (`fr`, `en`, `es`, `it`, `de`, `pt`, `nl`, `pl`, `ro`, `ru`, `tr`, `ar`, `he`, `zh`, `ja`, `ko`, `lsf`, `lsfb`). Mêmes droits. Index GIN `idx_profiles_languages` et `idx_profiles_playing_ages`. Les trois listes sont aussi dans `src/lib/constants.ts` (`PLAYING_AGES`, `ROLE_TYPES`, `LANGUAGES`) : à garder alignées. `NULL` = non renseigné (une liste vide est refusée) |

> **Workflow crédibilité recruteur (chantier 2, migration `20260614_recruiter_verification.sql`).** La description pro d'un recruteur est un **champ sensible** : à l'édition (`api/dashboard/profile` PATCH, `account_type='recruiter'`), la nouvelle valeur va dans `bio_pending` + `recruiter_review_status='pending'` ; le public continue de voir `bio`. L'admin approuve (`bio = bio_pending`, reset) ou refuse (`bio_pending=null`, `status='rejected'`, `bio` conservée) via `api/admin`. La **vérification** (`recruiter_verified`) est accordée/retirée par l'admin ; une modif en attente **ne la met pas en pause** (le public ne voit que la version validée). Depuis le 10/08/2026, cette vérification ne suffit plus à faire apparaître le badge — voir [« Badge recruteur vérifié »](#badge-verifie). Champs **anodins** (avatar, localisation, liens, coordonnées) : publication directe, hors workflow.
>
> **Motif de refus (07/08/2026, migration `20260807_recruiter_review_reason.sql`).** `recruiter_review_reason` (TEXT nullable) porte le motif du dernier refus : écrit par `reject_recruiter_edit`, nettoyé par `approve_recruiter_edit` et par toute nouvelle soumission. Lisible par le recruteur via GET `api/dashboard/profile` uniquement (colonne **jamais accordée** à anon/authenticated — créée après le retrait du SELECT table-level, donc service role seul ; les colonnes révoquées passent de 14 à **15**). MoiClient affiche un bandeau « Modification refusée » avec ce motif. À la soumission, les admins sont notifiés par **push FCM** (`sendPushToUser`, best-effort).

### 2. profile_roles
`id` (UUID PK), `profile_id` (UUID → profiles), `role_name` (TEXT). Roles multiples par profil.

### 3. projects — 13 colonnes

| Colonne | Type | Nullable | Note |
|---|---|---|---|
| `id` | UUID | non | PK |
| `profile_id` | UUID | non | FK → profiles. **Responsable** du film ; devient nullable avec la migration `20261008` (voir « Gestion des films ») |
| `title` | TEXT | non | |
| `slug` | TEXT | non | UNIQUE |
| `description` | TEXT | oui | |
| `category` | `project_category` | non | **vrai enum** |
| `year` | INTEGER | non | |
| `video_url` | TEXT | non | URL brute saisie (rendue par react-player) |
| `video_key` | TEXT | oui | Identifiant **canonique** `youtube:<id>`/`vimeo:<id>` extrait de `video_url` (`extractVideoKey`, `lib/utils.ts`). `NULL` si plateforme non reconnue. Anti-vol d'œuvre (chantier 9). |
| `created_at` | TIMESTAMPTZ | oui | |
| `status` | TEXT | oui | CHECK en prod (`pending`/`approved`/`refused`, relevé du 08/10/2026) ; modération des films |
| `poster_url` | TEXT | oui | |
| `preview_url` | TEXT | oui | |
| `episode_count` | INTEGER (CHECK > 0) | oui | **lot 10, migration `20261023`** : série, nombre d'épisodes. NULL pour un film |
| `episodes` | JSONB (tableau) | oui | **lot 10** : série, épisodes `[{id, title}]` (`id` = vidéo YouTube), figés à la publication ou à la dernière actualisation. Écrite par le service role uniquement |

> **Anti-doublon (chantier 9)** — index **unique partiel** `projects_video_key_unique` sur `(video_key) WHERE video_key IS NOT NULL` : une même vidéo (identifiant canonique) ne peut exister que sur **un** projet. Les films dont l'URL n'est pas normalisable (`video_key` NULL) ne sont jamais bloqués. Migrations manuelles : `20260614_video_dedup_A.sql` (colonne + backfill + détection), `20260614_video_dedup_resolve.sql` (résolution des doublons existants → garde le plus ancien, met les autres à NULL), `20260614_video_dedup_B.sql` (index unique). La vérification applicative renvoie un **409** propre ; l'index est le dernier rempart (course → code `23505` → 409).

### 4. project_credits
`id`, `project_id` (→ projects), `profile_id` (→ profiles, nullable, ON DELETE SET NULL), `ghost_name` (TEXT, nullable), `role_on_project` (TEXT). CHECK `credit_has_person` : `profile_id` OU `ghost_name` non-null. Mecanisme de credits croises (decouverte).

> **Suppression d'un compte credite (24/09/2026)** — un credit lie a un compte a `ghost_name` NULL (credit proprietaire, invitation acceptee). Sans garde, le `ON DELETE SET NULL` violait `credit_has_person` et annulait toute la suppression de l'utilisateur. Trigger `keep_credit_name_on_profile_delete` (`BEFORE DELETE` sur `profiles`, fonction `SECURITY DEFINER`, `search_path` vide, `EXECUTE` revoque a `public`/`anon`/`authenticated`) : avant la suppression, remplit `ghost_name` avec le nom public (`stage_name` s'il est non vide, sinon `full_name`) sur les credits ou il est NULL. Un `ghost_name` existant n'est jamais ecrase. Resultat : les credits sur les films des autres deviennent des credits fantomes nommes ; ceux sur ses propres films partent avec le film (`projects` en cascade). Migration : `supabase/migrations/20260924_credits_keep_name_on_delete.sql` (+ `_rollback.sql`).

### 5. contact_requests — ⚠️ **LEGACY (plus utilisée par le code)**
`id`, `from_name`, `from_email`, `to_profile_id` (→ profiles), `subject` (`contact_subject`, **enum**), `message`, `status` (`contact_status`, **enum**, nullable), `created_at`.
> Ancien canal de contact (formulaire nom/email/objet/message), **antérieur à la messagerie**. Retiré du code (nettoyage) : `ContactModal`, `/api/contact` et `/api/dashboard/contacts` supprimés ; le contact est désormais **unifié sur la messagerie** (depuis le 10/08/2026 : un compte gratuit initie vers **2 personnes**, le Pro sans limite ; tout le monde reçoit et répond librement). **Table conservée en base** (pas de `DROP`, historique préservé, réactivable). Le type `ContactRequest` est gardé dans `database.ts` tant que la table existe.

### 6. conversations
`id`, `participant_1` (→ profiles), `participant_2` (→ profiles), `last_message_at` (nullable), `created_at`.

> **Une conversation = une paire de profils.** `participant_1` est l'**initiateur** par **convention applicative** : les deux chemins d'insertion (`api/messages` POST et `api/messages/conversation` POST) l'écrivent ainsi. Aucune contrainte ne peut exprimer « qui a commencé » ; il faudrait une colonne dédiée (`initiator_id`), dont le quota gratuit n'a pas besoin. Cette convention est la base du quota « 2 personnes contactées » et du quota journalier.
>
> **Unicité de la paire (migration `20260810_conversations_pair_unique.sql`, ⚠️ à exécuter).** Index **unique sur expression** `conversations_pair_unique` sur `(least(participant_1, participant_2), greatest(participant_1, participant_2))` : une paire de profils ne peut avoir qu'une conversation, quel que soit l'ordre des colonnes. Une contrainte `UNIQUE` de table ne pouvant pas porter sur une expression, c'est nécessairement un index. Sans lui, un doublon ferait compter la même personne deux fois dans le quota gratuit et casserait le lookup applicatif. Plus un CHECK `conversations_distinct_participants` (`participant_1 <> participant_2`), une auto-conversation gonflant le quota d'une personne inexistante. **État vérifié avant écriture de la migration (lecture seule, 10/08/2026) : 4 conversations, 4 paires distinctes, 0 doublon, 0 auto-conversation** — les deux contraintes passent sans nettoyage.
>
> Effet de bord **déjà géré côté code** : une insertion concurrente sur la même paire renvoie désormais `23505`. `createOrReuseConversation()` (`lib/messaging.ts`) l'attrape, relit la conversation existante et la **réutilise silencieusement** — la course se résout en réutilisation, pas en erreur (contrairement à l'anti-doublon vidéo, qui renvoie un 409 : ici les deux appels voulaient bien la même conversation).

### 7. messages
`id`, `conversation_id` (→ conversations), `sender_id` (→ profiles), `content` (TEXT), `is_read` (BOOLEAN, nullable), `created_at`.

### 8. credit_requests
`id`, `project_id` (→ projects), `requester_id` (→ profiles), `role` (TEXT), `message` (nullable), `status` (TEXT libre ⚠️), `created_at`.

### 9. invitations — invitation par EMAIL (chantier 10)
Inviter un collaborateur **absent** d'Unkast. `id`, `project_id` (→ projects), `email` (TEXT), `role` (TEXT), `token` (**UUID**, défaut `gen_random_uuid()`, **unique**, usage unique du lien), `credit_id` (→ project_credits, **ON DELETE CASCADE** — le ghost credit lié), `inviter_id` (→ profiles, le créateur), `status` (TEXT : `pending`/`accepted`/`expired`), `expires_at` (défaut `now() + 30 jours`), `created_at`.
> **Unicité (email, projet)** : index `invitations_email_project_key` sur `(lower(email), project_id)` — une personne peut être créditée sur plusieurs films mais **une seule invitation par film** (anti-spam ciblé). Migrations manuelles : `20260614_invitations_email_A.sql` (colonnes + durcissement token + détection doublons), `20260614_invitations_email_B.sql` (bascule unicité email-global → (email,projet)). Flux : `POST /api/invitations` crée **ghost credit + invitation** et envoie l'email via **Resend** ; à l'inscription via `?invitation=<token>`, le ghost credit est rattaché au nouveau profil **uniquement si l'email du compte == l'email invité**.

### 10. project_invitations
Invitation d'un profil existant. `id`, `project_id` (→ projects), `invited_profile_id` (→ profiles), `inviter_id` (→ profiles), `role` (TEXT), `message` (nullable), `status` (TEXT libre ⚠️), `created_at` (nullable).

### 11. admin_logs
Journal des actions admin. `id`, `admin_id` (→ profiles), `action` (TEXT), `target_type` (TEXT), `target_id` (nullable), `details` (JSONB, nullable), `created_at`.

### 12. push_tokens
Tokens de notifications push par profil. `id`, `profile_id` (→ profiles), `token` (TEXT), `platform` (TEXT, defaut `android`), `created_at`.

### 13. rate_limits
Compteur de limitation de debit. `key` (TEXT PK, ex. `signup:<ip>`), `count` (INTEGER, defaut 0), `window_start` (TIMESTAMPTZ). Manipulee via la RPC `check_rate_limit(p_key, p_max, p_window_seconds)` (SECURITY DEFINER, `service_role` uniquement). Voir migration `supabase/migrations/20260610_rate_limits.sql`.

> **RPC `recompute_plan(p_profile_id uuid)` (2026-08-10)** — calcule et ecrit `profiles.plan`/`pro_since` a partir de deux sources independantes : abonnement Stripe actif (`subscription_status` dans `active`/`trialing`/`past_due`) OU grant offert valide (`pro_grant_type` non null et `pro_grant_expires_at` null ou future). `plan='pro'` si l'une ou l'autre est vraie. SECURITY DEFINER (ecrit malgre RLS), `service_role` uniquement — meme posture que `check_rate_limit`. Ne lit aucune donnee liee a l'appelant (pas de `current_user`/`auth.uid()`), uniquement la ligne `profiles` designee par le parametre : verrouillee en lecture (`for update`) pour serialiser un webhook et une action admin concurrents sur le meme profil. Seule fonction autorisee a ecrire `plan`/`pro_since` depuis ce commit — le webhook et les actions admin l'appellent, ils n'ecrivent plus ces deux colonnes directement. Voir migration `supabase/migrations/20260810_pro_grants.sql`.

### 14. reports
Signalements moderes. `id`, `reporter_id` (→ profiles), `target_type` (TEXT — `profile`/`project`/`message`), `target_id` (UUID), `reason` (TEXT), `description` (nullable), `status` (TEXT libre ⚠️, defaut `pending`), `reviewed_by` (→ profiles, nullable), `reviewed_at` (nullable), `created_at`.

### 15. waitlist
Liste d'attente. `id`, `email` (TEXT), `type` (TEXT), `name` (nullable), `company` (nullable), `message` (nullable), `status` (TEXT libre ⚠️, defaut `pending`), `created_at`.

### 16. availability_signals *(recrutement — chantier 2)*
Signal « Disponible » : un talent (ou creator non-recruteur) se signale pour **un poste precis** chez **un recruteur**. `id`, `talent_id` (→ profiles, cascade), `recruiter_id` (→ profiles, cascade), `role` (TEXT — un des `recruiting_roles` du recruteur), `created_at`, `expires_at` (TIMESTAMPTZ, defaut `now() + 30 jours`). Contraintes : `UNIQUE (talent_id, recruiter_id, role)` (prolonger/re-signaler = UPDATE, jamais de doublon), `CHECK (talent_id <> recruiter_id)`. Les lignes **expirees sont conservees** (filtre applicatif `expires_at > now()`), pas de purge. Voir migration `supabase/migrations/20260614_recruitment.sql`.

### 17. recruiter_folders *(recrutement — chantier 2)*
Dossiers-films **prives** du recruteur (« Film A »…), invisibles des talents. `id`, `recruiter_id` (→ profiles, cascade), `name` (TEXT), `created_at`.

### 18. folder_candidates *(recrutement — chantier 2)*
Rangement d'un candidat dans un dossier (dispatch). `id`, `folder_id` (→ recruiter_folders, cascade), `talent_id` (→ profiles, cascade), `role` (TEXT — poste retenu **dans ce film**), `signal_id` (→ availability_signals, nullable, `ON DELETE SET NULL` — provenance ; le rangement survit a l'expiration du signal), `added_at`. `UNIQUE (folder_id, talent_id, role)`.

### 19. recruiter_dismissals *(recrutement — chantier 2)*
Ecartement **silencieux** d'un candidat, **par poste**. `id`, `recruiter_id` (→ profiles, cascade), `talent_id` (→ profiles, cascade), `role` (TEXT), `created_at`. `UNIQUE (recruiter_id, talent_id, role)`. Table **separee** exprès (jamais lisible par le talent) → l'ecartement est **structurellement invisible** cote talent. « Liste a traiter d'un poste » = `availability_signals` (non expires) **MINUS** `recruiter_dismissals`.

> **Usage des tables 16-19.** Côté talent : bouton « Disponible » sur `profil/[slug]` → `/api/availability` (écrit `availability_signals`). Côté recruteur : espace pré-casting dans `/moi` (onglet « Recrutement », composant `RecruitmentSpace`, visible si Pro createur/recruteur) → `/api/recruitment/*` (candidatures groupées, dossiers `recruiter_folders`, dispatch `folder_candidates`, écartement `recruiter_dismissals`). « Contacter » réutilise la messagerie existante (l'espace pré-casting est de toute façon réservé aux Pro, dont les contacts sont illimités). Voir `docs/api-routes.md`.

### 20. stripe_events *(fiabilité — 2026-07-02)* — ⚠️ **migration à exécuter**
Idempotence des webhooks Stripe. `id` (TEXT PK — Stripe `event.id`), `type` (TEXT), `received_at` (TIMESTAMPTZ, défaut `now()`). Le webhook (`api/billing/webhook`) **revendique** `event.id` par INSERT **avant** toute écriture sur `profiles` : doublon (23505) → 200 sans traitement ; échec de traitement → la ligne est supprimée (le retry Stripe rejouera). RLS activée **sans policy** (service role uniquement, même posture que `rate_limits`). Migration manuelle : `supabase/migrations/20260702_stripe_events.sql` — **pas encore exécutée en prod** ; tant qu'elle ne l'est pas, le webhook traite sans dédup (42P01 toléré, loggé).

## Gestion des films *(migration `20261008_film_management.sql`, ⚠️ à exécuter)*

> **État au 08/10/2026** : la migration `20261008_film_management.sql` a été exécutée en
> production (indiqué par Maxime). La migration `20261009_film_limit_and_edit_watch.sql`
> (plafond, titre validé, voir plus bas) puis `20261010_film_poster_and_member_teasers.sql`
> (image du film, cartes verrouillées) `20261011_film_refusal_reasons.sql` (motifs de refus,
> durée) et `20261012_terms_acceptance.sql` (acceptation des CGU) sont **à exécuter**, dans cet ordre, avant de déployer le code qui les attend.
> Ordre de mise en ligne : [mise-en-ligne-gestion-films.md](mise-en-ligne-gestion-films.md). Décision : [ADR 0014](adr/0014-responsable-et-co-gestionnaires.md).

### Modèle

- **Responsable** : `projects.profile_id`, un seul par film, **nullable** (FK `ON DELETE SET NULL`).
  Lui seul retire le film, change sa visibilité et le transfère.
- **Co-gestionnaires** : table `project_managers`. Ils modifient les infos, l'équipe et les
  crédits, sans retirer ni dépublier.
- **Gestionnaire** = Responsable ou co-gestionnaire (`is_project_manager`).
- Le **nom du réalisateur** affiché vient des crédits de réalisation (`is_director_role` en base,
  `isDirectorRole` dans `src/lib/credits.ts`), plus du Responsable. Aucun crédit de réalisation =
  aucun nom.
- Le **plafond de films** (compte gratuit : 3, Pro : illimité) compte les films dont on est
  Responsable et qui sont **en ligne** (approuvés, publics ou membres seulement) ou **en attente
  de validation**. Les films refusés et dépubliés ne comptent pas. Fonction `project_slots_used`
  (migration `20261009`). Remettre en ligne un film dépublié est refusé si le compte gratuit est
  au plafond (`limit_reached`, trigger `zz_guard_projects_columns`).
- Le **lien vidéo** ne se modifie pas après la publication (colonne hors du GRANT UPDATE,
  restaurée par le trigger) : pour changer de vidéo, on publie un nouveau film.
- `project_moderation.approved_title` (migration `20261009`) : titre validé par l'admin, écrit à
  l'approbation et quand l'admin clique « Vu ». La liste « modifiés récemment » ne garde que les
  films dont le titre s'en écarte nettement (`src/lib/title-change.ts`) ou qui sont signalés.
- **Image du film** (`projects.poster_url`, migration `20261010`) : par défaut la vignette de la
  vidéo, lue chez YouTube ou Vimeo par le serveur à la publication (`src/lib/oembed.ts`). Un
  gestionnaire peut la remplacer par une image envoyée (bucket public `posters`, écrit par le
  service role uniquement, 4 Mo, WebP/JPEG/PNG) ou revenir à celle de la vidéo. La colonne reste
  protégée par le trigger : seule la route `/api/projects/[id]/poster` l'écrit. Aucune validation
  admin, rien dans « modifiés récemment ».
- **Film « membres seulement » vu par un visiteur** (migration `20261010`) : la fonction
  `member_only_film_teasers(p_slug, p_profile_id)` renvoie uniquement `id`, `slug`, `title`,
  `poster_url`, `year` (un filtre obligatoire). Le lien vidéo, la description et l'équipe ne
  sortent pas de la base. Sert à la carte verrouillée (`src/components/LockedFilmCard.tsx`).
- **Filmographie d'une fiche** (migration `20261013`) : la fiche d'une personne liste les films
  qu'elle a publiés (elle en est Responsable) et ceux où elle est créditée. Une ligne de
  `project_credits` est un crédit accepté (les demandes en attente vivent dans `credit_requests`
  et `project_invitations`). Un membre lit ces crédits par la RLS. Un visiteur passe par
  `public_profile_film_roles` (films publics) et par `member_only_film_teasers(p_profile_id)`,
  qui renvoie aussi les films membres où la personne est créditée, avec deux colonnes en plus :
  `role_on_project` (son rôle, plusieurs crédits réunis par une virgule) et `is_responsible`.
  Les deux fonctions ne renvoient rien pour un profil non approuvé ou suspendu. Le masquage des
  crédits pour un visiteur est levé **sur la fiche de la personne seulement** ; la page d'un film
  garde les initiales (`public_project_credits` inchangée).
- **Refus d'un film** (migration `20261011`) : `project_moderation.refusal_reasons` (motifs cochés
  par l'admin, parmi `son`, `image`, `amateur`, `hors_sujet`, `droits`, `autre`, contraints par
  CHECK et alignés sur `REFUSAL_REASONS` de `src/lib/constants.ts`) et `refusal_note` (texte
  libre). Montrés au Responsable dans « Mes films » et dans l'email de refus, effacés si le film
  est approuvé ensuite. `source_duration` : durée de la vidéo en secondes (Vimeo seulement).
  La table reste fermée aux clients : la route `/api/dashboard/projects` lit le motif avec le
  service role, pour les seuls films que l'utilisateur gère.
- **Acceptation des CGU** (migration `20261012`) : `profiles.terms_version` et
  `profiles.terms_accepted_at`, liées par un CHECK (les deux ou aucune). Aucun droit client
  (les colonnes ajoutées à `profiles` n'héritent d'aucun GRANT) : écrites par le service role à
  l'inscription (`/api/signup`) et par `/api/terms/accept`. La version en vigueur est
  `TERMS_VERSION` dans `src/lib/legal.ts` ; la changer redemande l'acceptation à tous les membres.
- **Noms réels fermés (lot du 09/10/2026, en deux étapes)**. Le vrai nom n'est lisible que par
  la personne elle-même (route `/api/dashboard/profile`, client de confiance) et par l'admin.
  - Étape A, migration `20261014_profile_display_name.sql` : colonne générée `display_name`,
    lisible par anon et authenticated, index trigram `idx_profiles_display_name_trgm`. Rien
    n'est retiré.
  - Étape B, migration `20261015_profile_real_names_closed.sql` (**à exécuter**, contrôle de la
    prod fait le 09/10/2026 : aucune vue ni policy ne nomme ces colonnes, deux fonctions
    seulement, toutes deux SECURITY DEFINER) : retrait du SELECT sur `full_name`,
    `first_name`, `last_name`, `stage_name`, `display_name_preference` pour anon et
    authenticated. À lancer seulement quand le code qui lit `display_name` est en production.
  Tant que B n'est pas passée, ces colonnes restent lisibles avec la clé publique. Après B, une
  requête du client utilisateur qui nomme une de ces colonnes (select, filtre ou tri) est refusée
  en entier. L'écriture par la personne (UPDATE par colonne) n'est pas concernée.

### Colonnes ajoutées à `projects`

| Colonne | Type | Note |
|---|---|---|
| `profile_id` | UUID, **nullable** | NULL = film sans Responsable (compte supprimé sans co-gestionnaire), listé dans l'admin |
| `visibility` | TEXT, CHECK | `public` (défaut), `members` (membres connectés, `noindex`), `unpublished` (gestionnaires seuls) |

Index unique `projects_video_key_unique` : exclut désormais les films `refused` (un film refusé
libère sa vidéo). Backfill de `video_key` sur les films approuvés qui n'en avaient pas, sans rien
écraser en cas de collision.

### Nouvelles tables

| Table | Rôle | Accès client |
|---|---|---|
| `project_managers` | co-gestionnaires (`project_id`, `profile_id`, `added_by`) | SELECT par les gestionnaires ; DELETE par le Responsable ou par soi-même |
| `project_rights_declarations` | déclaration de droits, ajout seul (`declared_role`, `text_version`, `client_authorized`, `declared_at`) | SELECT de ses déclarations ; INSERT par le Responsable (accord client exigé pour pub et clip) |
| `project_manager_requests` | invitation (`invite`, par le Responsable) ou demande (`request`, par une personne créditée) | SELECT par la personne concernée et le Responsable ; DELETE par son auteur tant qu'elle est en attente |
| `project_claims` | signalement ou revendication, avec justificatif (bucket privé `claims`) | SELECT de ses propres demandes |
| `project_moderation` | titre et chaîne oEmbed (`source_title`, `source_author`), dernière modification d'un film approuvé | aucun (service role) |
| `career_entries` | Parcours du profil : `title`, `role`, `year`, `kind` (11 types), `production` | lecture publique d'un profil approuvé et non suspendu ; écriture par le propriétaire |

`reports` : `reporter_id` devient nullable (NULL = signalement automatique), motif `contact_info`,
cible `career_entry`.

### Fonctions

| Fonction | Appelant | Rôle |
|---|---|---|
| `is_project_owner`, `is_project_manager`, `is_member`, `is_project_public`, `can_view_project` | policies | `is_member` = connecté + profil approuvé + non suspendu |
| `extract_video_key(text)` | migration, RPC | même logique que `extractVideoKey` (`src/lib/utils.ts`) |
| `is_director_role(text)` | `public_project_credits` | rôle découpé sur `&`, `,`, `/`, normalisé (casse, accents, espaces, tirets) |
| `public_project_credits(uuid[])` | anon, authenticated | équipe des films publics pour un visiteur : initiales, nom en clair et lien pour les seuls crédits de réalisation. Le nom est le **nom affiché** (même règle que `getDisplayName`, `src/lib/profile.ts` : nom de scène si choisi, sinon prénom + nom, sinon `full_name`), les initiales en découlent |
| `related_public_projects(uuid, int)` | anon, authenticated | films liés d'un film public pour un visiteur : identifiants de films publics partageant une personne créditée et nombre de collaborateurs communs, aucune identité |
| `public_profile_film_roles(uuid)` | anon, authenticated | rôle du titulaire d'un profil sur tous les films publics où il est crédité, qu'il en soit Responsable ou non (migration `20261013`) ; rien si le profil n'est pas approuvé ou est suspendu. Sert à sa page profil pour un visiteur |
| `career_text_ok(text)` | CHECK de `career_entries` | refuse `http`, `www`, `@`, « arobase », suffixes de domaine. Pas de règle sur les chiffres : les numéros relèvent du détecteur serveur |
| `publish_project(...)` | **service role** | seule voie de création d'un film : plafond, doublon, déclaration de droits, crédits, données oEmbed, dans une transaction. Renvoie `{ok, code, ...}` |
| `request_project_manager`, `decide_project_manager`, `transfer_project` | **service role** | co-gestion et transfert, avec l'identité de l'utilisateur en paramètre |

### Triggers

| Trigger | Table | Effet |
|---|---|---|
| `zz_guard_projects_columns` | `projects` BEFORE UPDATE | même modèle que `guard_profiles_system_columns` (SECURITY INVOKER, laisse passer `rolbypassrls`). Restaure les colonnes système. Lève `owner_only` (42501) si un co-gestionnaire change la visibilité, `rights_declaration_required` (P0001) si le Responsable modifie le contenu sans déclaration, `client_authorization_required` (P0001) si le film passe en publicité ou en clip sans accord client déclaré par le Responsable |
| `track_project_edit`, `track_project_credit_edit` | `projects`, `project_credits` | note la dernière modification d'un film approuvé (`project_moderation`), pour la liste « modifiés récemment » de l'admin |
| `transfer_projects_on_profile_delete` | `profiles` BEFORE DELETE | le film passe au co-gestionnaire le plus ancien ; sinon il reste, sans Responsable, dépublié |
| `limit_career_entries` | `career_entries` BEFORE INSERT | 30 entrées par profil (`career_limit_reached`) |

### Privilèges et policies modifiés

- `projects` : plus d'INSERT client (tout passe par `publish_project`) ; UPDATE limité par GRANT
  aux colonnes `title`, `description`, `category`, `year`, `visibility`, policy « gestionnaires ».
  Lecture : approuvé + `public` pour tous, + `members` pour un membre, tout pour ses gestionnaires.
- `project_credits` : un visiteur non connecté ne lit plus aucune ligne (liste vide, pas d'erreur) ;
  écriture par les gestionnaires.
- `credit_requests` : UPDATE limité à `status` ; DELETE par le demandeur tant que la demande est
  en attente (`requester_can_cancel_pending`).
- `project_invitations`, `invitations` : création réservée aux gestionnaires du film ;
  `project_id` ne se modifie plus.
- `anon` perd INSERT, UPDATE, DELETE, TRUNCATE sur les tables concernées ; `authenticated` perd TRUNCATE.
- `profiles` : `recruiter` retiré des CHECK `pro_grant_*`.

### Failles fermées (relevé prod du 08/10/2026)

Invitation sur le film d'un autre, déplacement d'une invitation vers un autre film, UPDATE complet
de `credit_requests`, annulation d'une demande de crédit sans effet, équipe d'un film non public
lisible par tous, INSERT direct dans `projects` contournant plafond et anti-doublon.

## Index

- **schema.sql** : `idx_profiles_slug`, `idx_profiles_status`, `idx_projects_slug`, `idx_projects_profile_id`, `idx_project_credits_project_id`, `idx_project_credits_profile_id`, `idx_contact_requests_to_profile`, `idx_profile_roles_profile_id`.
- **migration `20260610_search_trgm_indexes.sql`** : extension `pg_trgm` + index GIN trigram (`idx_profiles_full_name_trgm`, `idx_profiles_bio_trgm`, `idx_profiles_location_trgm`, `idx_projects_title_trgm`, `idx_projects_description_trgm`) + `idx_profiles_status`, `idx_projects_status_category`. Accelerent les `ILIKE '%...%'` de `/api/search`.
- **migration `20260614_recruitment.sql`** : `availability_signals_recruiter_role_exp_idx` (recruiter_id, role, expires_at), `recruiter_folders_recruiter_idx`, `folder_candidates_folder_idx`, `folder_candidates_talent_idx`, `recruiter_dismissals_recruiter_role_idx` + les index implicites des contraintes UNIQUE.
- **migration `20260614_recruiter_verification.sql`** : `profiles_recruiter_review_pending_idx` (index **partiel** sur `recruiter_review_status = 'pending'`) + CHECK `profiles_recruiter_review_status_check`.
- **migration `20260614_stripe_billing.sql`** : `profiles_stripe_customer_id_idx` (**unique**, partiel) + `profiles_stripe_subscription_id_idx` (partiel).

> **Workflow Stripe (chantier 7, mode TEST) — modèle grant, livré 2026-08-10.** Souscription : `/pro` → `POST /api/billing/checkout` (Stripe Checkout hébergé) → **webhook** `POST /api/billing/webhook` (seule source de vérité pour la comptabilité Stripe, signature vérifiée sur raw body) écrit `stripe_subscription_id`, `subscription_status`, `current_period_end`, puis appelle `recompute_plan()`. Le webhook ne consulte **plus jamais** `pro_grant_*` avant d'écrire — il est souverain sur ses propres colonnes dans tous les cas, y compris un profil qui a par ailleurs un grant offert actif. Auto-gestion via `POST /api/billing/portal` (Stripe Customer Portal). Le webhook ne retrouve un profil que par `stripe_customer_id` (un profil sans customer n'est jamais touché). Aucune donnée de carte stockée.
>
> **Pro offert (grant admin), indépendant de Stripe.** `grant_pro` (ex-`set_pro`, renommée le 2026-08-10 — la coexistence des deux noms dans `admin_logs` date volontairement le changement de modèle) pose `pro_grant_type`/`pro_grant_expires_at`/`pro_grant_granted_by`/`pro_grant_granted_at` puis appelle `recompute_plan()`. ⚠️ `approve_recruiter` **n'accorde plus aucun Pro depuis le 10/08/2026** (nouveau modèle économique) : il ne pose que `recruiter_status='approved'`, n'écrit aucun `pro_grant_*` et n'appelle plus `recompute_plan()`. Plus aucun chemin de code ne crée de grant `'recruiter'` — ce type a d'ailleurs été retiré du modèle le même jour, voir [« Les types de grant »](#types-de-grant). Les deux sources (Stripe et grant) **coexistent sans conflit** : un grant qui expire ou est révoqué ne touche jamais aux colonnes Stripe, et réciproquement — c'est `recompute_plan()` qui arbitre `plan` à partir des deux, jamais une écriture directe. `revoke_pro_grant` efface le grant. Aucune action admin n'annule un abonnement Stripe (le Customer Portal reste l'unique voie de résiliation, y compris pour un admin agissant sur son propre compte). Cron quotidien `GET /api/cron/pro-expiry` (voir [api-routes.md](api-routes.md)) : recompute les grants `'launch'` échus, envoie le rappel J-7. Le propriétaire du profil voit l'origine/l'échéance de son Pro via `GET /api/me` et `GET /api/dashboard/profile` (`/pro` et `/moi`).
>
> **Vue d'ensemble complète du modèle** : voir la section [« Modèle Pro — deux sources, une dérivation »](#modele-pro) plus bas dans ce document.

<a id="modele-pro"></a>
## Modèle Pro — deux sources, une dérivation *(chantier grants, 2026-08-10)*

> Ce qu'il faut savoir pour toucher au Pro sans redécouvrir l'historique. Contexte complet (pourquoi
> ce modèle a remplacé l'ancien) : voir les commentaires en tête de
> [`20260810_pro_grants.sql`](../supabase/migrations/20260810_pro_grants.sql). En résumé, l'ancien
> modèle (`pro_source='admin'|'stripe'`) mélangeait *pourquoi*, *jusqu'à quand* et *qui* dans une seule
> colonne, et son garde-fou webhook (« si `pro_source='admin'`, ne jamais toucher `plan` ») était
> **inconditionnel** : un profil offert par l'admin qui souscrivait ensuite payait mais restait
> Pro à vie même après résiliation, et un clic accidentel sur un abonné payant l'immunisait pour
> toujours contre toute rétrogradation.

### Les deux sources

`plan` n'est plus écrit directement nulle part (sauf par la RPC ci-dessous) : c'est une valeur
**dérivée** de deux sources indépendantes et cumulables.

| Source | Colonnes | Souverain | Ne connaît jamais l'autre source |
|---|---|---|---|
| **Abonnement Stripe** | `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `current_period_end` | `POST /api/billing/webhook` | ✅ n'inspecte plus `pro_grant_*` avant d'écrire |
| **Pro offert (grant admin)** | `pro_grant_type`, `pro_grant_expires_at`, `pro_grant_granted_by`, `pro_grant_granted_at`, `pro_grant_reminder_sent_at` | `POST /api/admin` (`grant_pro`/`revoke_pro_grant`) + `GET /api/cron/pro-expiry` (lecture seule sur ces colonnes, sauf `pro_grant_reminder_sent_at`) | ✅ n'inspecte jamais les colonnes Stripe |

Un profil peut cumuler les deux (ex. un VIP qui souscrit quand même — décision produit : on laisse
faire, `/pro` l'informe via un bandeau sans bloquer l'achat). Aucune des deux sources n'écrit jamais
`plan`/`pro_since` directement.

### La règle de dérivation

Une seule fonction est autorisée à écrire `plan`/`pro_since` : la RPC Postgres
`recompute_plan(p_profile_id uuid)` (SECURITY DEFINER, `service_role` uniquement — détail complet
dans la table `rate_limits` ci-dessus). Appelée par le webhook après chaque écriture Stripe, par
chaque action admin qui touche un grant, et par le cron après chaque expiration traitée.

```
stripe_actif  := subscription_status ∈ {active, trialing, past_due}
grant_valide  := pro_grant_type IS NOT NULL
              AND (pro_grant_expires_at IS NULL OR pro_grant_expires_at > now())

plan := 'pro'  SI (stripe_actif OU grant_valide)  SINON 'free'
pro_since := première acquisition, jamais réinitialisée tant que plan reste 'pro' en continu
```

Un grant expiré ne compte plus dans `grant_valide`, mais ses colonnes **ne sont jamais nettoyées** —
elles restent en base comme témoin (« Free · ex-lancement, expiré le X », visible côté admin et,
pour l'intéressé, tant qu'il n'a pas un nouveau grant, dans l'historique `admin_logs`).

<a id="types-de-grant"></a>
### Les types de grant

| Type | Échéance | Qui peut le poser | Comment il se retire |
|---|---|---|---|
| `launch` | **Obligatoire** (CHECK) — cadeau de lancement, pas de Pro à vie non voulu par oubli | Admin, via `grant_pro` (modal « Offrir Pro… », AdminClient) | Expire seul (cron), ou `revoke_pro_grant` |
| `vip` | **Libre** — `null` = à vie, une date reste possible pour une durée longue déterminée | Admin, via `grant_pro` | `revoke_pro_grant`, ou expire si une échéance avait été posée |

> ⚰️ **Un troisième type, `recruiter`, a existé du 10/08/2026 (création, migration
> `20260810_pro_grants.sql`) au même jour (retrait).** Il était posé uniquement par `approve_recruiter`
> (jamais d'échéance, CHECK `NULL` strict) et ne se retirait que via `revoke_recruiter_approval`. Le
> nouveau modèle économique a supprimé la règle « recruiter ⇒ pro » : `approve_recruiter` ne pose plus
> aucun grant. Le seul profil qui portait ce type en base a été purgé manuellement (vérifié en SQL),
> puis le CHECK `profiles_pro_grant_type_check` a été resserré à `('launch', 'vip')` par la migration
> [`20260810_pro_grants_type_cleanup.sql`](../supabase/migrations/20260810_pro_grants_type_cleanup.sql)
> — **aucune ligne ne peut plus porter cette valeur**, le type n'existe plus nulle part (base, CHECK,
> `PRO_GRANT_TYPES`/`ProGrantType` côté TS, garde-fous de `api/admin`, badge admin `proBadge()`). Les
> garde-fous qui empêchaient `grant_pro`/`revoke_pro_grant` d'écraser un grant `recruiter` ont été
> retirés (devenus sans objet) ; `revoke_recruiter_approval` ne fait plus que retirer
> `recruiter_status`, il n'y a plus rien à nettoyer côté grant.

Ces règles sont appliquées à trois niveaux redondants, du plus au moins strict : le CHECK Postgres
`profiles_pro_grant_expiry_check` (dernier rempart, ne peut pas être contourné même par un accès
direct à la base), `validateGrantExpiry()` côté serveur (`lib/pro-plan.ts`, message clair au lieu
d'un 500 brut), et le même import côté `AdminClient.tsx` (désactive le bouton avant l'envoi).

### Qui a le droit d'écrire quoi

| Colonnes | Écrivain(s) autorisé(s) |
|---|---|
| `plan`, `pro_since` | **Uniquement** `recompute_plan()` (RPC) |
| `stripe_customer_id` | `api/billing/checkout` (création), `api/billing/webhook` (rattachement `client_reference_id`) |
| `stripe_subscription_id`, `subscription_status`, `current_period_end` | **Uniquement** `api/billing/webhook` |
| `pro_grant_type`, `pro_grant_expires_at`, `pro_grant_granted_by`, `pro_grant_granted_at` | `api/admin` : `grant_pro` (pose, launch/vip), `revoke_pro_grant` (remise à `null`). ⚠️ Ni `approve_recruiter` ni `revoke_recruiter_approval` n'écrivent ces colonnes depuis le 10/08/2026 — le premier ne pose plus de grant, le second n'a donc plus rien à nettoyer |
| `pro_grant_reminder_sent_at` | **Uniquement** `api/cron/pro-expiry`, et seulement si l'email est **réellement parti** (`sendProExpiryReminderEmail` → `{sent:true}`) |
| `pro_source` | **Personne** — colonne gelée, conservée pour compat historique, `DROP` prévu post-lancement |

Aucune route n'annule un abonnement Stripe actif (pas de `cancel_subscription` côté admin) : la
résiliation passe exclusivement par le Customer Portal (`api/billing/portal`), y compris pour un
admin sur son propre compte.

<a id="badge-verifie"></a>
## Badge « recruteur vérifié » — double condition *(10/08/2026)*

Le badge public exige **deux** conditions, jamais une seule :

```
badge affiché := recruiter_verified = true  ET  plan = 'pro'
```

`recruiter_verified` reste la **vérification d'identité** accordée par l'admin
(`grant_recruiter_verified` / `revoke_recruiter_verified`) ; `plan` vient de Stripe ou d'un grant.
Conséquence voulue : **un recruteur vérifié qui résilie perd son badge**, et le récupère s'il
resouscrit — sans aucune action admin.

**Rien n'est stocké ni synchronisé.** La condition est évaluée **à l'affichage**, ce qui évite tout
hook sur le webhook Stripe et tout risque de badge fantôme après une rétrogradation. Aucune écriture
n'est déclenchée par un changement de plan.

| Site | Fichier | Comment |
|---|---|---|
| **Profil public** | `app/(app)/profil/[slug]/page.tsx` → `ProfileClient.tsx` | Dérivé **côté serveur** : `plan` est lu par le select puis **retiré de l'objet** (destructuration) ; seul le booléen `show_verified_badge` atteint le client. La règle « la page publique n'expose pas le plan » tient toujours — le client ne rejoue pas la condition, il affiche le booléen |
| **Admin — recruteurs approuvés** | `app/admin/AdminClient.tsx` (`VerifiedPill`) | Affiche les **deux** états : « Vérifié » (bleu) si le badge est réellement public, « Vérifié · masqué (Free) » (gris, pointillés + tooltip) si le toggle est posé mais le compte est free |
| **Admin — modifs en attente** | `app/admin/AdminClient.tsx` (`VerifiedPill`) | Idem, même composant |

Le bouton **Vérifier / Retirer vérif.** reste piloté par `recruiter_verified` **seul** : c'est la
seule chose que l'admin contrôle, le Pro venant de Stripe ou d'un grant. `api/admin` GET
`tab=recruiters` sélectionne `plan` pour les deux listes.

⚠️ **La recherche et la messagerie n'affichent aucun badge** (vérifié le 10/08/2026 : `plan` et
`recruiter_verified` sont absents du select de `app/(app)/recherche/page.tsx`). Si un badge y est
ajouté un jour, il devra porter la même double condition.

## Row Level Security (RLS)

- **Tables d'origine** (`profiles`, `profile_roles`, `projects`, `project_credits`, `contact_requests`) : RLS active, policies versionnees dans `schema.sql` (lecture publique si `status='approved'` ou proprietaire ; ecriture par le proprietaire ; `contact_requests` INSERT ouvert a tous).
- **API admin** : utilise `createAdminClient()` (service role, **bypass RLS**) ; l'autorisation repose sur `profiles.is_admin`.

### Tables ajoutees — RLS auditee (introspection prod, 13/06/2026 ; recrutement 14/06/2026)

✅ **Les 14 tables ont `rowsecurity = true` avec des policies correctes** (10 auditees le 13/06 + les 4
tables de recrutement creees et verifiees actives le 14/06). RLS non encore versionnee dans
`schema.sql` (a inclure lors de la regeneration ; pour le recrutement, source =
`supabase/migrations/20260614_recruitment.sql`).

> ⚠️ **Correction du 31/07/2026, mise a jour le 10/08/2026 (chantier grants).** Cette section
> affirmait auparavant que les `GRANT` larges a `anon`/`authenticated` etaient « neutralises par la
> RLS active, pas un risque ». **C'est faux pour `profiles`** : la RLS filtre les LIGNES, jamais les
> COLONNES. Une ligne de profil etant lisible publiquement (`status='approved'`), n'importe qui
> pouvait lire `contact_email`, `is_admin` ou `stripe_customer_id` en interrogeant PostgREST avec la
> cle anon. **20 colonnes de `profiles` sont aujourd'hui revoquees** pour `anon` et `authenticated`
> (14 d'origine + 1 ajoutee le 07/08 + 5 le 10/08) : `is_admin`, `contact_email`, `contact_phone`,
> `recruiter_status`, `recruiter_document_url`, `recruiter_review_status`, `bio_pending`,
> `suspended_at`, `suspended_reason`, `pro_source`, `stripe_customer_id`, `stripe_subscription_id`,
> `subscription_status`, `current_period_end`, `recruiter_review_reason`, `pro_grant_type`,
> `pro_grant_expires_at`, `pro_grant_granted_by`, `pro_grant_granted_at`, `pro_grant_reminder_sent_at`.
>
> Migrations : [`20260731_profiles_column_grants.sql`](../supabase/migrations/20260731_profiles_column_grants.sql)
> (retro-documentee, la regle avait ete posee a la main) + [`20260807_recruiter_review_reason.sql`](../supabase/migrations/20260807_recruiter_review_reason.sql)
> + [`20260810_pro_grants.sql`](../supabase/migrations/20260810_pro_grants.sql) (les 5 colonnes
> `pro_grant_*` naissent directement hors du GRANT table-level, aucun REVOKE explicite necessaire — voir
> le commentaire de cette derniere migration). Cote code : elles ne sont lues **que** par le service
> role (`api/dashboard/profile` GET via `PRIVILEGED_COLUMNS`, `api/me`, `lib/supabase/middleware.ts`,
> `api/billing/*`, `api/admin`, `api/cron/pro-expiry`). **`plan` n'est PAS revoque** :
> `hooks/useUserStatus.ts` le lit depuis le navigateur pour le gating Pro.
>
> **La revocation porte sur le SELECT, pas sur l'UPDATE.** `contact_email` et `contact_phone` sont
> accordees en UPDATE a `authenticated` et restent donc **ecrites par le client utilisateur** dans le
> PATCH, comme les autres champs editables. C'est sans risque parce que l'update ne chaine pas
> `.select()` : postgrest-js n'ajoute `Prefer: return=representation` que dans `select()`, donc PostgREST
> repond 204 sans `RETURNING` et n'exerce aucun privilege de lecture sur ce qu'on ecrit. Chainer un
> `.select()` sur cet update declencherait un 403 sur les colonnes retournees.
>
> **Regle a tenir (assouplie le 10/08/2026)** : `OWN_COLUMNS` + `PRIVILEGED_COLUMNS` dans
> `api/dashboard/profile/route.ts` couvraient jusque-la exactement les colonnes de `profiles` (invariant
> « contrat complet »). Depuis le chantier grants, **3 colonnes en sont exclues expres** :
> `pro_grant_granted_by`, `pro_grant_granted_at`, `pro_grant_reminder_sent_at` — details d'audit admin
> (qui a accorde le grant, quand un rappel est parti), pas des informations que l'utilisateur doit lire
> sur son propre profil via cette route. `OWN_COLUMNS` (31) + `PRIVILEGED_COLUMNS` (17) = 48 colonnes
> sur 51 ; les 3 manquantes sont un choix documente, pas un oubli. Toute AUTRE colonne nouvellement
> revoquee doit toujours passer de la premiere liste a la seconde (sinon PostgREST renvoie
> `permission denied` et /moi casse) — l'exception ci-dessus ne s'applique qu'aux 3 colonnes nommees.
>
> Les `GRANT` par defaut restent en revanche sans danger sur les autres tables, dont aucune ligne n'est
> lisible publiquement (scope participants, proprietaire ou admin).

| Table | RLS | Policy reelle |
|---|---|---|
| `conversations` | ✅ on | SELECT/écriture scopees aux **participants** (`participant_1`/`participant_2` = `auth.uid()`) |
| `messages` | ✅ on | SELECT/INSERT scopes aux **participants de la conversation** |
| `credit_requests` | ✅ on | Scopee au **proprietaire** (requester + owner du projet) |
| `project_invitations` | ✅ on | Scopee au proprietaire (invite + inviteur) |
| `invitations` (legacy) | ✅ on | Scopee au proprietaire du projet |
| `push_tokens` | ✅ on | Scopee au **proprietaire** (`profile_id = auth.uid()`) |
| `reports` | ✅ on | Reservee aux **admins** (lecture/moderation) |
| `admin_logs` | ✅ on | Reservee aux **admins** |
| `waitlist` | ✅ on | INSERT ouvert a tous (`with_check = true`) ⚠️ ; lecture reservee aux admins |
| `rate_limits` | ✅ on | **Aucune policy** → accessible uniquement via le **service role** (RPC `check_rate_limit`) |
| `availability_signals` | ✅ on | SELECT = `talent_id` **OU** `recruiter_id` = `auth.uid()` ; INSERT = `talent_id=auth.uid()` + garde-fou cible (`is_recruiting`+`plan='pro'`+`role ∈ recruiting_roles`) + emetteur `account_type <> 'recruiter'` ; UPDATE/DELETE = `talent_id=auth.uid()` |
| `recruiter_folders` | ✅ on | `FOR ALL` scopee au **recruteur** (`recruiter_id=auth.uid()`) — aucune lecture talent |
| `folder_candidates` | ✅ on | `FOR ALL` via le dossier parent (`recruiter_folders.recruiter_id=auth.uid()`) — aucune lecture talent |
| `recruiter_dismissals` | ✅ on | `FOR ALL` scopee au **recruteur** — **aucune policy SELECT talent** → ecartement invisible |

> **RLS recrutement (migration `20260614_recruitment.sql`)** : l'invisibilite des dossiers et de l'ecartement est **structurelle** (tables sans aucune policy SELECT cote talent), pas seulement applicative. C'est la raison d'avoir mis l'ecartement dans une table separee plutot qu'une colonne sur `availability_signals` (ligne que le talent a le droit de lire).

**Points mineurs (pas des risques bloquants) :**
1. **`waitlist`** accepte l'insertion par tous (`with_check = true`) — voulu pour l'inscription publique a la liste d'attente, mais **expose a du spam a terme** (deja attenue par le rate-limit 5/IP/h cote `/api/waitlist`).
2. **`rate_limits`** a la RLS activee **sans aucune policy** : c'est volontaire — la table n'est manipulee que par le service role via la RPC `SECURITY DEFINER` ; anon/authenticated n'y ont aucun acces.

## Quotas et limites (code-verifies)

| Limite | Valeur | Source |
|---|---|---|
| Films / compte (free) | **3** | `lib/constants.ts` (`MAX_PROJECTS_FREE`) — 2 → 3 le 10/08/2026. Tous les textes qui annoncent la limite l'**interpolent** depuis cette constante (`/pro`, `/rejoindre`, dashboard, `/moi`, email d'expiration) : ne jamais réécrire le nombre en dur |
| Films / compte (pro) | **30** | `lib/constants.ts` (`MAX_PROJECTS_PRO`) — plafond plan-aware (`api/dashboard/projects` POST) |
| **Personnes contactées (free, à vie)** | **2** | `lib/constants` non concerné — `lib/messaging.ts` (`FREE_CONTACT_LIMIT`, 10/08/2026). Compte les conversations **initiées** dans lesquelles on a **envoyé au moins un message**. Garde serveur au **premier message** (`api/messages` POST), pré-vérification au clic (`api/messages/conversation` POST). Fail-closed (503 `count_unavailable`). Le Pro est illimité |
| Nouvelles conversations / jour | 5 | `lib/messaging.ts` (`DAILY_CONVERSATION_LIMIT`) — tous plans ; inatteignable en free (2 à vie < 5 par jour) |
| Blocage coordonnees (1ers messages) | < 3 messages | `api/messages/route.ts`, RÈGLE 5 *(numéro de ligne non fixé — la restructuration du 10/08/2026 l'a déjà déplacé une fois)* |
| Relance si non-reponse | 48 h | `api/messages/route.ts`, RÈGLE 4 |
| Rate limit signup | 5 / IP / heure | `api/signup/route.ts:10` |
| Rate limit waitlist | 5 / IP / heure | `api/waitlist/route.ts:8` |

> Le **prix Pro (9,99 €) n'existe nulle part dans le code** : pas de constante, pas de paiement (Stripe absent).

## Dette technique (notee dans le type)

1. **Colonnes TEXT libres restantes** (recruiter_status, display_name_preference, show_*_to, statuts invitations/credits/reports/waitlist, projects.status) — aucune contrainte base. Convertir en enums Postgres ou ajouter des `CHECK`. *(account_type et plan : desormais contraints par CHECK — fait.)*
2. ✅ **`account_type` tranche** (decision produit, migration faite) : ROLE = `talent`/`creator`/`recruiter`, defaut `talent` ; `member` supprime. `plan` = `free`/`pro`, **totalement independant du role** depuis le 10/08/2026 (la regle `recruiter ⇒ pro` n'existe plus, ni en base ni cote code).
3. **`is_looking_for`, `recruiter_*`** : colonnes creees mais jamais alimentees en prod. Verifier si le code les ecrit.
4. **`schema.sql` a regenerer** depuis la base (10 tables + colonnes manquantes + RLS des nouvelles tables).

> **Compte admin dedie (migration `20261017_admin_account.sql`).** `account_type='admin'` ajoute a `profiles_account_type_check`. Policy RESTRICTIVE `"Admin accounts are private"` sur `profiles` (SELECT, anon et authenticated) : une ligne admin n'est lisible que par son compte. Fonction `reject_admin_account()` + triggers du meme nom sur `conversations` (participants) et `project_credits` (`profile_id`) : un compte admin ne peut pas y figurer. Les droits restent portes par `is_admin`.

> **Policies basees sur `is_admin` retirees (migration `20261018_drop_admin_policies.sql`).** `reports` "Admins manage reports", `waitlist` "Admins manage waitlist", `admin_logs` "Admins only" : acces admin direct sans second facteur, inutilise par le code (ces trois tables ne sont lues et ecrites que par le service role). RLS laissee active. La seule porte admin est `/api/admin` (`getAdminId()`).

> **`reports` et `waitlist` fermees aux clients (migration `20261019_drop_unused_client_policies.sql`).** Policies "Users can create reports", "Users see own reports" et "Anyone can join waitlist" retirees : inutilisees (tout passe par le service role) et elles permettaient un INSERT direct hors des controles des routes. `reports`, `waitlist` et `admin_logs` n ont plus aucune policy, RLS active.

> **Ecritures directes fermees (migration `20261020_close_direct_writes.sql`, audit RLS du 09/10/2026).** Plus aucune ecriture cliente sur `project_credits` (sauf suppression par un gestionnaire), `project_invitations`, `invitations`, `profile_roles`, `contact_requests` : les routes ecrivent en service role. Lecture publique de `profiles`, `profile_roles`, `projects` et fonctions `can_view_project` / `is_project_public` : un compte suspendu en est exclu. Declencheur `lock_availability_signal_target` : destinataire et poste d un signal non modifiables. `credit_requests` : insertion en `pending` sur un film visible uniquement. Bucket `avatars` limite a 5 Mo et aux images, sans policy. Droits de table inutiles retires (dont `TRUNCATE`). A executer APRES le deploiement du code.

> **Unicites (migration `20261021_uniqueness.sql`, audit de la base du 10/10/2026, a executer apres 20261020).** `credit_requests` : l'unicite `(project_id, requester_id)` tous statuts confondus est remplacee par l'index unique partiel `credit_requests_one_pending` (`WHERE status = 'pending'`) : une personne refusee, ou creditee puis retiree, peut redemander. `project_credits` : index unique `project_credits_one_role_per_person` sur `(project_id, profile_id, lower(btrim(role_on_project))) WHERE profile_id IS NOT NULL` ; les routes d'acceptation traitent `23505` comme « deja credite ». `push_tokens` : `UNIQUE (token)` en plus de `UNIQUE (profile_id, token)` ; `POST /api/notifications/register` detache d'abord le jeton de tout autre compte (service role).

> **Séries (lot 10, étape 1, migrations `20261022_series_A.sql` puis `20261023_series_B.sql`, à exécuter AVANT le déploiement du code).** Une série est une ligne `projects` de catégorie `serie` : elle compte pour 1 film dans `project_slots_used` et suit la même validation admin. `video_url` porte l'adresse canonique de la playlist YouTube (`https://www.youtube.com/playlist?list=<id>`), `video_key` vaut `youtube-playlist:<id>` : `extract_video_key` reconnaît cette adresse, donc `publish_project` et l'index `projects_video_key_unique` refusent une playlist déjà publiée sans autre changement. `episode_count` et `episodes` sont hors du GRANT UPDATE client : écrites à la publication (`POST /api/dashboard/projects`) et par `POST /api/projects/[id]/episodes`. La catégorie `serie` ne se change pas par la route (`series_category_locked`) ; aucune contrainte en base ne l'empêche.
