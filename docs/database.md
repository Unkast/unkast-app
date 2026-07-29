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
| `project_category` | `court-metrage`, `moyen-metrage`, `long-metrage`, `publicite`, `clip`, `documentaire`, `bande-demo`, `scene-extrait` |
| `contact_subject` | `collaboration`, `project`, `question`, `other` |
| `contact_status` | `pending`, `accepted`, `declined` |

### Colonnes TEXT contraintes par CHECK

Decision produit actee (migration manuelle) : `account_type` (ROLE) et `plan` sont desormais
contraints en base, independants l'un de l'autre.

| Colonne | Type TS | Valeurs autorisees | Contrainte base |
|---|---|---|---|
| `profiles.account_type` | `AccountType` | `talent` (defaut), `creator`, `recruiter` | ✅ `profiles_account_type_check` ; bascule **talent↔creator** par l'utilisateur (`api/dashboard/profile`), `recruiter` reserve a l'admin |
| `profiles.plan` | `Plan` | `free` (defaut), `pro` | ✅ `profiles_plan_check` |

> `member` a ete supprime du modele (migre vers `talent`). Regle metier **recruiter ⇒ plan `pro`**
> appliquee **cote code** (souplesse essai gratuit / recruteur en cours de validation), volontairement
> sans CHECK strict en base. `NULL` reste tolere par le CHECK (defaut applicatif `talent`).

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

### 1. profiles — 44 colonnes

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
| `pro_source` | TEXT | oui | **chantier 7** — `'admin'` (manuel, à vie) / `'stripe'` (abonnement) / `null`. **Garde-fou** : un `'admin'` n'est jamais rétrogradé par le webhook |
| `recruiter_status` | TEXT libre | oui | ⚠️ null en prod |
| `recruiter_company` | TEXT | oui | ⚠️ null en prod |
| `recruiter_role` | TEXT | oui | ⚠️ null en prod |
| `recruiter_website` | TEXT | oui | ⚠️ null en prod |
| `recruiter_document_url` | TEXT | oui | ⚠️ null en prod |
| `bio_pending` | TEXT | oui | **chantier 2** — version EN ATTENTE de la description pro (recruteur). `null` = rien en attente |
| `recruiter_verified` | BOOLEAN | non | **chantier 2** — defaut `false` ; badge « recruteur vérifié » (accordé par l'admin) |
| `recruiter_verified_at` | TIMESTAMPTZ | oui | **chantier 2** — date d'octroi du badge (audit) |
| `recruiter_review_status` | TEXT (CHECK) | non | **chantier 2** — `none` (defaut) / `pending` / `rejected` — ✅ `profiles_recruiter_review_status_check` ; index partiel sur `pending` |
| `is_suspended` | BOOLEAN | oui | defaut `false` — **chantier 3** : effectif côté serveur (garde `getActiveUser` sur les API sensibles) **et** retrait de la vue publique (recherche/feed/profil/projet via `is_suspended IS NOT TRUE`) |
| `suspended_at` | TIMESTAMPTZ | oui | |
| `suspended_reason` | TEXT | oui | |
| `first_name` | TEXT | oui | |
| `last_name` | TEXT | oui | |
| `stage_name` | TEXT | oui | |
| `display_name_preference` | TEXT libre | oui | defaut `real_name` — ⚠️ non contraint |
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

> **Workflow crédibilité recruteur (chantier 2, migration `20260614_recruiter_verification.sql`).** La description pro d'un recruteur est un **champ sensible** : à l'édition (`api/dashboard/profile` PATCH, `account_type='recruiter'`), la nouvelle valeur va dans `bio_pending` + `recruiter_review_status='pending'` ; le public continue de voir `bio`. L'admin approuve (`bio = bio_pending`, reset) ou refuse (`bio_pending=null`, `status='rejected'`, `bio` conservée) via `api/admin`. Le **badge « recruteur vérifié »** (`recruiter_verified`) est accordé/retiré par l'admin ; une modif en attente **ne le met pas en pause** (le public ne voit que la version validée). Champs **anodins** (avatar, localisation, liens, coordonnées) : publication directe, hors workflow.

### 2. profile_roles
`id` (UUID PK), `profile_id` (UUID → profiles), `role_name` (TEXT). Roles multiples par profil.

### 3. projects — 13 colonnes

| Colonne | Type | Nullable | Note |
|---|---|---|---|
| `id` | UUID | non | PK |
| `profile_id` | UUID | non | FK → profiles |
| `title` | TEXT | non | |
| `slug` | TEXT | non | UNIQUE |
| `description` | TEXT | oui | |
| `category` | `project_category` | non | **vrai enum** |
| `year` | INTEGER | non | |
| `video_url` | TEXT | non | URL brute saisie (rendue par react-player) |
| `video_key` | TEXT | oui | Identifiant **canonique** `youtube:<id>`/`vimeo:<id>` extrait de `video_url` (`extractVideoKey`, `lib/utils.ts`). `NULL` si plateforme non reconnue. Anti-vol d'œuvre (chantier 9). |
| `created_at` | TIMESTAMPTZ | oui | |
| `status` | TEXT libre | oui | ⚠️ non contraint ; moderation des films (`pending`/`approved`/`refused`) |
| `poster_url` | TEXT | oui | |
| `preview_url` | TEXT | oui | |

> **Anti-doublon (chantier 9)** — index **unique partiel** `projects_video_key_unique` sur `(video_key) WHERE video_key IS NOT NULL` : une même vidéo (identifiant canonique) ne peut exister que sur **un** projet. Les films dont l'URL n'est pas normalisable (`video_key` NULL) ne sont jamais bloqués. Migrations manuelles : `20260614_video_dedup_A.sql` (colonne + backfill + détection), `20260614_video_dedup_resolve.sql` (résolution des doublons existants → garde le plus ancien, met les autres à NULL), `20260614_video_dedup_B.sql` (index unique). La vérification applicative renvoie un **409** propre ; l'index est le dernier rempart (course → code `23505` → 409).

### 4. project_credits
`id`, `project_id` (→ projects), `profile_id` (→ profiles, nullable, ON DELETE SET NULL), `ghost_name` (TEXT, nullable), `role_on_project` (TEXT). CHECK `credit_has_person` : `profile_id` OU `ghost_name` non-null. Mecanisme de credits croises (decouverte).

### 5. contact_requests — ⚠️ **LEGACY (plus utilisée par le code)**
`id`, `from_name`, `from_email`, `to_profile_id` (→ profiles), `subject` (`contact_subject`, **enum**), `message`, `status` (`contact_status`, **enum**, nullable), `created_at`.
> Ancien canal de contact (formulaire nom/email/objet/message), **antérieur à la messagerie**. Retiré du code (nettoyage) : `ContactModal`, `/api/contact` et `/api/dashboard/contacts` supprimés ; le contact est désormais **unifié sur la messagerie** (seul un Pro initie, tout le monde reçoit/répond). **Table conservée en base** (pas de `DROP`, historique préservé, réactivable). Le type `ContactRequest` est gardé dans `database.ts` tant que la table existe.

### 6. conversations
`id`, `participant_1` (→ profiles), `participant_2` (→ profiles), `last_message_at` (nullable), `created_at`.

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

> **Usage des tables 16-19.** Côté talent : bouton « Disponible » sur `profil/[slug]` → `/api/availability` (écrit `availability_signals`). Côté recruteur : espace pré-casting dans `/moi` (onglet « Recrutement », composant `RecruitmentSpace`, visible si Pro createur/recruteur) → `/api/recruitment/*` (candidatures groupées, dossiers `recruiter_folders`, dispatch `folder_candidates`, écartement `recruiter_dismissals`). « Contacter » réutilise la messagerie Pro existante. Voir `docs/api-routes.md`.

### 20. stripe_events *(fiabilité — 2026-07-02)* — ⚠️ **migration à exécuter**
Idempotence des webhooks Stripe. `id` (TEXT PK — Stripe `event.id`), `type` (TEXT), `received_at` (TIMESTAMPTZ, défaut `now()`). Le webhook (`api/billing/webhook`) **revendique** `event.id` par INSERT **avant** toute écriture sur `profiles` : doublon (23505) → 200 sans traitement ; échec de traitement → la ligne est supprimée (le retry Stripe rejouera). RLS activée **sans policy** (service role uniquement, même posture que `rate_limits`). Migration manuelle : `supabase/migrations/20260702_stripe_events.sql` — **pas encore exécutée en prod** ; tant qu'elle ne l'est pas, le webhook traite sans dédup (42P01 toléré, loggé).

## Index

- **schema.sql** : `idx_profiles_slug`, `idx_profiles_status`, `idx_projects_slug`, `idx_projects_profile_id`, `idx_project_credits_project_id`, `idx_project_credits_profile_id`, `idx_contact_requests_to_profile`, `idx_profile_roles_profile_id`.
- **migration `20260610_search_trgm_indexes.sql`** : extension `pg_trgm` + index GIN trigram (`idx_profiles_full_name_trgm`, `idx_profiles_bio_trgm`, `idx_profiles_location_trgm`, `idx_projects_title_trgm`, `idx_projects_description_trgm`) + `idx_profiles_status`, `idx_projects_status_category`. Accelerent les `ILIKE '%...%'` de `/api/search`.
- **migration `20260614_recruitment.sql`** : `availability_signals_recruiter_role_exp_idx` (recruiter_id, role, expires_at), `recruiter_folders_recruiter_idx`, `folder_candidates_folder_idx`, `folder_candidates_talent_idx`, `recruiter_dismissals_recruiter_role_idx` + les index implicites des contraintes UNIQUE.
- **migration `20260614_recruiter_verification.sql`** : `profiles_recruiter_review_pending_idx` (index **partiel** sur `recruiter_review_status = 'pending'`) + CHECK `profiles_recruiter_review_status_check`.
- **migration `20260614_stripe_billing.sql`** : `profiles_stripe_customer_id_idx` (**unique**, partiel) + `profiles_stripe_subscription_id_idx` (partiel).

> **Workflow Stripe (chantier 7, mode TEST).** Souscription : `/pro` → `POST /api/billing/checkout` (Stripe Checkout hébergé) → **webhook** `POST /api/billing/webhook` (seule source de vérité, signature vérifiée sur raw body) pose `plan='pro'`, `pro_since`, `subscription_status`, `current_period_end`, `pro_source='stripe'`. Retrait à l'annulation/expiration (`subscription.deleted`/`updated`) → `plan='free'`. Auto-gestion via `POST /api/billing/portal` (Stripe Customer Portal). **Garde-fou** : le webhook ne retrouve un profil que par `stripe_customer_id` (un Pro manuel sans customer n'est jamais touché) **et** ne rétrograde jamais `pro_source='admin'`. `set_pro`/`approve_recruiter` posent `pro_source='admin'` sans toucher les `stripe_*`. Aucune donnée de carte stockée.

## Row Level Security (RLS)

- **Tables d'origine** (`profiles`, `profile_roles`, `projects`, `project_credits`, `contact_requests`) : RLS active, policies versionnees dans `schema.sql` (lecture publique si `status='approved'` ou proprietaire ; ecriture par le proprietaire ; `contact_requests` INSERT ouvert a tous).
- **API admin** : utilise `createAdminClient()` (service role, **bypass RLS**) ; l'autorisation repose sur `profiles.is_admin`.

### Tables ajoutees — RLS auditee (introspection prod, 13/06/2026 ; recrutement 14/06/2026)

✅ **Les 14 tables ont `rowsecurity = true` avec des policies correctes** (10 auditees le 13/06 + les 4
tables de recrutement creees et verifiees actives le 14/06). Les `GRANT` larges a
`anon`/`authenticated` sont la config Supabase par defaut, **neutralisee par la RLS active** — pas un
risque. RLS non encore versionnee dans `schema.sql` (a inclure lors de la regeneration ; pour le
recrutement, source = `supabase/migrations/20260614_recruitment.sql`).

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
| Films / compte (free) | **2** | `lib/constants.ts` (`MAX_PROJECTS_FREE`) |
| Films / compte (pro) | **30** | `lib/constants.ts` (`MAX_PROJECTS_PRO`) — plafond plan-aware (`api/dashboard/projects` POST) |
| Nouvelles conversations / jour | 5 | `api/messages/route.ts:63` |
| Blocage coordonnees (1ers messages) | < 3 messages | `api/messages/route.ts:136` |
| Relance si non-reponse | 48 h | `api/messages/route.ts:119` |
| Rate limit signup | 5 / IP / heure | `api/signup/route.ts:10` |
| Rate limit waitlist | 5 / IP / heure | `api/waitlist/route.ts:8` |

> Le **prix Pro (9,99 €) n'existe nulle part dans le code** : pas de constante, pas de paiement (Stripe absent).

## Dette technique (notee dans le type)

1. **Colonnes TEXT libres restantes** (recruiter_status, display_name_preference, show_*_to, statuts invitations/credits/reports/waitlist, projects.status) — aucune contrainte base. Convertir en enums Postgres ou ajouter des `CHECK`. *(account_type et plan : desormais contraints par CHECK — fait.)*
2. ✅ **`account_type` tranche** (decision produit, migration faite) : ROLE = `talent`/`creator`/`recruiter`, defaut `talent` ; `member` supprime. `plan` = `free`/`pro`, independant. Regle `recruiter ⇒ pro` cote code.
3. **`is_looking_for`, `recruiter_*`** : colonnes creees mais jamais alimentees en prod. Verifier si le code les ecrit.
4. **`schema.sql` a regenerer** depuis la base (10 tables + colonnes manquantes + RLS des nouvelles tables).
