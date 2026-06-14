# Unkast — Routes API

> Regenere 2026-06-13 depuis le code (`src/app/api/**` + `src/app/(app)/auth/callback`). Le MVP
> documentait 6 routes ; le code en compte **31** (+ 1 route handler `auth/callback`).
> *(Nettoyage : l'ancien canal `contact_requests` — `/api/contact` + `/api/dashboard/contacts` — a été retiré ; le contact est unifié sur la messagerie. Table conservée en base.)*
> *(Chantier 7 : ajout de `/api/billing/checkout`, `/api/billing/webhook`, `/api/billing/portal` — paiement Stripe en **mode TEST**.)*
> Auth = verification `supabase.auth.getUser()` cote serveur. « Admin » = check `profiles.is_admin`
> via `createAdminClient()` (service role).

## Resume

### Public (sans auth)

| Route | Methodes | Tables lues | Tables ecrites | Notes |
|---|---|---|---|---|
| `/api/billing/webhook` | POST | — | `profiles` | **Stripe** — pas d'auth utilisateur, **vérif de signature** sur raw body. Seule source de vérité du Pro |
| `/api/search` | GET | `profiles`, `profile_roles`, `projects` | — | filtre `status='approved'` |
| `/api/signup` | POST | — | `profiles`, `profile_roles`, `projects`, `project_credits`, `credit_requests` | rate-limit 5/IP/h |
| `/api/waitlist` | POST | — | `waitlist` | rate-limit 5/IP/h |
| `/api/credits/status` | GET | `projects`, `project_credits`, `credit_requests` | — | auth optionnelle |

### Authentifie

| Route | Methodes | Tables lues | Tables ecrites |
|---|---|---|---|
| `/api/dashboard/profile` | GET, PATCH | `profiles`, `profile_roles` | `profiles`, `profile_roles` |
| `/api/dashboard/projects` | GET, POST, DELETE | `projects`, `project_credits` | `projects`, `project_credits` |
| `/api/dashboard/credits` | GET | `projects`, `credit_requests`, `project_credits`, `profiles` | — |
| `/api/avatar` | POST, DELETE | `profiles` | `profiles`, Storage `avatars` |
| `/api/logout` | POST | — | — |
| `/api/messages` | POST, GET | `profiles`, `conversations`, `messages` | `conversations`, `messages` |
| `/api/messages/[conversationId]` | GET | `conversations`, `messages`, `profiles` | `messages` (is_read) |
| `/api/messages/conversation` | POST | `conversations`, `profiles` | `conversations` |
| `/api/messages/read` | PATCH | `messages`, `conversations` | `messages` |
| `/api/messages/unread-count` | GET | `messages` | — |
| `/api/messages/daily-count` | GET | `conversations` | — |
| `/api/invitations` | POST | `projects`, `profiles`, `rate_limits` | `project_credits`, `invitations` + email Resend |
| `/api/invitations/claim` | GET | `invitations`, `projects` | — (lecture) |
| `/api/invitations/project` | POST, GET | `projects`, `project_invitations`, `profiles` | `project_invitations` |
| `/api/invitations/project/[id]` | PATCH, DELETE | `project_invitations`, `project_credits`, `profiles`, `projects` | `project_invitations`, `project_credits` |
| `/api/credits/request` | POST | `project_credits`, `projects`, `profiles`, `credit_requests` | `credit_requests` |
| `/api/credits/[id]` | PATCH, DELETE | `credit_requests`, `projects`, `project_credits` | `credit_requests`, `project_credits` |
| `/api/reports` | POST | `reports`, `admin_logs` | `reports`, `admin_logs` |
| `/api/notifications/register` | POST | — | `push_tokens` |
| `/api/availability` | GET, POST, PATCH, DELETE | `profiles`, `availability_signals` | `availability_signals` |
| `/api/recruitment/candidates` | GET | `profiles`, `availability_signals`, `recruiter_dismissals`, `folder_candidates` | — |
| `/api/recruitment/folders` | GET, POST, PATCH, DELETE | `recruiter_folders`, `folder_candidates` | `recruiter_folders` |
| `/api/recruitment/folders/[id]` | GET | `recruiter_folders`, `folder_candidates`, `profiles` | — |
| `/api/recruitment/dispatch` | POST, DELETE | — | `folder_candidates` |
| `/api/recruitment/dismissals` | POST, DELETE | — | `recruiter_dismissals` |
| `/api/billing/checkout` | POST | `profiles` | `profiles` (stripe_customer_id) + Stripe (Checkout Session) |
| `/api/billing/portal` | POST | `profiles` | Stripe (Billing Portal Session) |

### Admin (`profiles.is_admin`)

| Route | Methodes | Tables lues | Tables ecrites |
|---|---|---|---|
| `/api/admin` | GET, PATCH | `profiles`, `projects`, `reports`, `admin_logs` | `profiles`, `projects`, `reports`, `admin_logs` |

> Route handler associe (hors `/api`) : `app/(app)/auth/callback/route.ts` — echange le code OAuth/magic-link,
> cree le profil si absent (`profiles`, `profile_roles`).

## Detail des routes notables

### GET /api/search
Recherche unifiee talents + projets. Params : `q`, `type` (`all`/`talents`/`projets`), `category`, `location`, `role`, `sort` (`pertinence`/`date`/`projets`). Filtre `status='approved'`, limite 50/type.
**Performance** : utilise des **joins Supabase** (`profile_roles(...)`, `projects(id)`, `profiles!fk(...)`) — **2 requetes au total**, enrichissement en `.map()`. (L'ancienne note « pattern N+1 ~150 requetes » etait fausse — corrigee.) Indexes trigram via migration `20260610_search_trgm_indexes.sql`.
**Mise en avant Pro** : le `plan` est un **critere de tri SECONDAIRE** (departage a rang egal, jamais « Pro d'abord »). Le `plan` reste **interne au tri**, non expose dans la reponse. Même tie-break dans la vitrine « Je recrute » de `recherche/page.tsx`.

### /api/availability *(recrutement — chantier 2, cote talent)*
Gere les signaux « Disponible » d'un talent vers un recruteur qui affiche « Je recrute ». Client scope utilisateur → **RLS appliquee a toutes les ecritures** (vrai backstop), en plus du garde-fou serveur.
- **GET `?recruiter=<id>`** : signaux **actifs** (`expires_at > now()`) du visiteur vers ce recruteur → `{ signals: [{role, expires_at}] }`. Non connecte → `{ signals: [] }`.
- **POST `{ recruiter_id, role }`** : cree (ou **re-active** un signal expire conserve, via upsert `onConflict (talent_id,recruiter_id,role)`, `expires_at = now()+30j`). **Garde-fou serveur** : 401 si non connecte, 400 si auto-signalement, **403** si la cible n'est pas `is_recruiting && plan='pro' && role ∈ recruiting_roles` (le serveur lit `plan`, jamais expose au navigateur).
- **PATCH `{ recruiter_id, role }`** : prolonge (`expires_at = now()+30j`).
- **DELETE `{ recruiter_id, role }`** : retire le signal.

> **Pas de rate-limit** ici (signal sans texte, risque faible) — le throttle anti-abus est traite au chantier 3 (moderation). UI cote talent : bloc « Te signaler disponible » sur `profil/[slug]`, masque pour les Pro (Pro↔Pro = contact direct), sur son propre profil, et invite a se connecter si anonyme.

### /api/recruitment/* *(recrutement — chantier 2, espace pré-casting côté recruteur)*
Espace de travail du recruteur Pro. **Garde-fou commun** (`api/recruitment/guard.ts` → `getProUser`) : 401 si non connecté, **403 si `plan !== 'pro'`**. Le badge `is_recruiting` n'est **pas** requis (il gère la visibilité côté talent, pas l'accès à l'espace). Client scopé utilisateur → **RLS = backstop** (recruteur propriétaire uniquement sur `recruiter_folders`/`folder_candidates`/`recruiter_dismissals`).
- **`GET /api/recruitment/candidates`** : candidatures groupées par poste = `availability_signals` (recruiter_id=moi, `expires_at > now()`) **MINUS** `recruiter_dismissals`, jointes au profil talent, avec l'appartenance aux dossiers (`folder_candidates`) pour l'UI « Ranger ».
- **`/api/recruitment/folders`** : **GET** (dossiers + nb candidats distincts), **POST** `{name}` (créer), **PATCH** `{id,name}` (renommer), **DELETE** `?id=` (supprimer — cascade SQL retire les rangements).
- **`GET /api/recruitment/folders/[id]`** : détail d'un dossier (candidats rangés, groupés par poste).
- **`/api/recruitment/dispatch`** : **POST** `{folder_id, talent_id, role, signal_id?}` (ranger, upsert idempotent), **DELETE** (retirer du dossier).
- **`/api/recruitment/dismissals`** : **POST** `{talent_id, role}` (écarter, silencieux), **DELETE** (annuler — sert l'undo UI).

> **Contacter un candidat retenu** ne crée aucune route : réutilise `POST /api/messages/conversation` (Pro-gated) → `conversation_id` → navigation `/messages/<id>`. **Pas de rate-limit** sur l'espace (privé, authentifié).

### Modération & suspension (chantier 3)
**Garde commun `getActiveUser` ([lib/auth-guard.ts](../src/lib/auth-guard.ts))** : authentifie + **bloque les comptes suspendus** (`is_suspended`) côté serveur, et renvoie le profil (plan/account_type/full_name) pour mutualiser les lectures. Branché sur les **écritures sensibles** : `api/messages` POST, `api/reports` POST, `api/availability` POST/PATCH/DELETE, `api/recruitment/*` écritures (via `guard.ts` → `getProUser`/`getProWriter`). Comble le trou : le middleware ne protégeait que la **navigation** (et excluait `/api`).
- **Retrait de la vue publique** d'un suspendu (filtre applicatif `is_suspended IS NOT TRUE`, pas de RLS modifiée) : `recherche` (talents + films via owner), `feed` (talents + films), page `profil/[slug]` (→ 404), page `projet/[slug]` (→ 404 si propriétaire suspendu).
- **Rate-limit** (réutilise `checkRateLimit`, fail-open, clé = `user.id`) : `api/reports` (10/h), `api/availability` POST (30/h), `api/recruitment/*` écritures (60/h, via `getProWriter`).
- **Signalement en conversation** : `messages/[id]` ouvre le `ReportModal` ciblant le **profil de l'interlocuteur** (`target_type='profile'`, actionnable admin). Aucune route nouvelle.
- **Alerte prioritaire** : `api/admin` GET `tab=reports` trie par `total_reports` décroissant et ajoute `urgent: total_reports >= 3` ; l'UI admin remonte ces signalements en tête (marqueur « URGENT »). **Aucun blocage automatique** (décision : l'humain tranche).
- **Coordonnées** : le helper `getVisibleContactInfo` (mort) a été **supprimé** et les réglages `show_*_to` **masqués** dans l'UI (/moi, dashboard). Colonnes conservées en base. Les coordonnées ne sont pas affichées publiquement (contact **uniquement** via la messagerie Pro).

### /api/billing/* — paiement Stripe (chantier 7, mode TEST)
Abonnement Pro via **Stripe Checkout** (page hébergée). **Aucune donnée de carte stockée** — uniquement des IDs Stripe. Clés/secrets **uniquement en variables d'env** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `NEXT_PUBLIC_SITE_URL`).
- **`POST /api/billing/checkout`** `{ interval: 'monthly'|'yearly' }` : auth requise ; récupère/crée le Stripe Customer (persiste `stripe_customer_id`), crée une Checkout Session `mode:'subscription'` (`client_reference_id = user.id`, `success_url`/`cancel_url`) → renvoie `url`. **N'accorde pas** le Pro.
- **`POST /api/billing/webhook`** : **seule source de vérité**. Vérifie la signature (`STRIPE_WEBHOOK_SECRET`) sur le **raw body** (`req.text()`). Traite `checkout.session.completed`, `customer.subscription.created/updated/deleted`. Retrouve le profil par `stripe_customer_id` → `plan='pro'`/`'free'`, `subscription_status`, `current_period_end`, `pro_source='stripe'`. **Garde-fou** : ne touche jamais un profil sans `stripe_customer_id` ; ne rétrograde jamais `pro_source='admin'`.
- **`POST /api/billing/portal`** : auth requise ; ouvre le Stripe Customer Portal (résiliation, carte, mensuel↔annuel) → renvoie `url`.

> **Page `/pro`** : boutons d'achat (Mensuel/Annuel/« Gérer ») visibles si `NEXT_PUBLIC_BILLING_ENABLED === 'true'` **OU** visiteur `is_admin` (test) ; sinon **liste d'attente** publique (inchangée). Bandeau « mode test » tant que `BILLING_ENABLED` est `false`. Pages retour `/pro/success` & `/pro/cancel` (informatives — le Pro vient du webhook). Coexistence admin : `set_pro` et `approve_recruiter` posent `pro_source='admin'` (Pro à vie) sans toucher les `stripe_*`.

### POST /api/signup
Inscription complete : cree l'utilisateur Auth, insere le profil (`status='pending'`), les roles, et optionnellement un premier projet + credits + **`credit_requests`**. Rate-limit `signup:<ip>` (5/h). Slugs via `slugify()` partage (`lib/utils.ts`).
**Anti-doublon vidéo (chantier 9)** : si le film fourni réutilise une vidéo déjà référencée (`video_key` identique), l'inscription **n'échoue pas** — le compte est créé, le **film est sauté**, et la réponse renvoie `{ video_skipped: true }` (l'UI `RejoindreClient` affiche un avertissement sur l'écran de confirmation). `video_key` est calculé via `extractVideoKey` et stocké à l'insert.
**Rattachement invitation (chantier 10)** : accepte `invitation_token`. Après création du profil, si le token est valide/pending/non expiré **ET** que `lower(email du compte) == lower(email invité)`, le **ghost credit** lié (`invitations.credit_id`) devient un vrai crédit (`profile_id` posé, `ghost_name` vidé), l'invitation passe `accepted`, push à l'inviteur. **Best-effort** : jamais d'échec global de l'inscription si le rattachement échoue ou si l'email diffère (anti-détournement).

### POST /api/dashboard/projects
Cree un projet. **Plafond plan-aware** (lu cote serveur) : **2 films si `plan = free`, 30 si `plan = pro`** (`MAX_PROJECTS_FREE` / `MAX_PROJECTS_PRO`). Champs requis : `title`, `category`, `video_url`. Insere projet + credit owner + credits ghost. 401 si non connecte. **Pas de PATCH/PUT** — un projet ne s'edite pas, seulement DELETE.
**Anti-doublon vidéo (chantier 9)** : calcule `video_key` (`extractVideoKey`) ; si une vidéo identique existe déjà → **409** `« Cette vidéo est déjà référencée sur Unkast. »`. Filet course : violation de l'index unique (`23505`) → même 409. `DashboardClient` / `MoiClient` affichent le message (toast) et **conservent le formulaire** pour correction.

### POST/DELETE /api/avatar
Upload / suppression de la photo de profil (Storage bucket `avatars`). **Pipeline image** : compression **navigateur** d'abord (`AvatarUpload` → canvas **512×512 WebP q0.8** ≈ 30–60 Ko, via `lib/image-compress.ts`) + **plafond d'entrée 10 Mo** côté client. **Garde-fou serveur** : type ∈ {jpeg,png,webp} + **taille ≤ 3 Mo** (vrai rempart anti-saturation, valide avant chargement en mémoire). Stocke `${user.id}/avatar.webp` (`upsert`), supprime l'ancien `avatar.jpg` legacy, met à jour `profiles.avatar_url` (`+ ?t=timestamp`). DELETE retire `.webp` + `.jpg` et remet `avatar_url` à null. *(Les affiches `poster_url`/`preview_url` ne sont PAS uploadées par l'utilisateur — `lib/image-compress.ts` est prêt à les couvrir le jour où la feature sera ajoutée.)*

### PATCH /api/dashboard/profile
Met a jour le profil. **Badge « Je recrute »** : `is_recruiting` / `recruiting_roles` ne sont ecrits **que si `plan = pro` ET `account_type ∈ {creator, recruiter}`** (verification serveur, sur le role EFFECTIF). Sinon forces a `false`/`[]` — un talent ou un compte gratuit ne peut pas l'activer, meme par appel API direct.
**Changement de role** : `account_type` accepte **uniquement les bascules `talent ↔ creator`**. Toute autre transition (vers/depuis `recruiter`) → **403** (le Pro recruteur reste attribue par l'admin a la validation). Une bascule `creator → talent` nettoie automatiquement le badge « Je recrute ». Le `plan` n'est jamais modifie par cette route.
**Description pro d'un recruteur (chantier 2)** : si `account_type='recruiter'` et que `bio` change, la nouvelle valeur va dans **`bio_pending`** + `recruiter_review_status='pending'` (la `bio` publique n'est PAS touchee) ; la reponse renvoie `{ pendingReview: true }`. Pour les autres comptes, `bio` est publiee directement. Les champs anodins (avatar, localisation, liens, coordonnees) restent en publication directe.

### POST /api/invitations  &  GET /api/invitations/claim  (chantier 10 — invitation email)
**POST** : inviter par email un collaborateur **absent** d'Unkast. Garde-fous : `getActiveUser` (bloque suspendus) + **`creator` uniquement** ; **projet possédé** par l'inviteur (sinon 403) ; **invitation toujours liée à un crédit réel** — crée le **ghost credit** (`project_credits.ghost_name`) puis l'`invitations` dans le même appel ; **double rate-limit** `invite:<userId>` (5/j) **et** `invite:global` (200/j) → **429** ; unicité (email, projet) → **409** « déjà invitée sur ce film » (avec rollback du ghost credit) ; **envoi via Resend uniquement** (`lib/email.ts`), **sauté proprement en dev sans `RESEND_API_KEY`** → réponse `{ success, email_sent }`. Body : `{ project_id, email, role, name? }`.
**GET /claim?token=** : résout une invitation pour pré-remplir l'inscription. **Anti-énumération** : renvoie `{ valid:false }` générique si token absent/invalide/expiré/déjà consommé ; sinon `{ valid:true, email, role, project_title }` (l'email sert à pré-remplir **et verrouiller** le champ dans `RejoindreClient`).

### /api/messages (POST)
Envoi de message / creation de conversation. Regles metier code-verifiees :
- Max **5** nouvelles conversations / jour pour l'initiateur (`route.ts:63`).
- Blocage des coordonnees (regex) tant que `< 3` messages echanges (`route.ts:136`).
- Relance impossible avant **48 h** si pas de reponse (`route.ts:119`).

### /api/admin (GET, PATCH)
Back-office complet (contredit l'ancienne note « pas de route admin »). GET par onglet : `recruiters` (renvoie aussi `edits` = descriptions pro en attente de re-validation), `reports` (trié par `total_reports` décroissant + flag `urgent` à ≥3), `users`, `films`. PATCH actions : `approve_recruiter`, `reject_recruiter`, `suspend_user`, `reactivate_user`, `set_pro`, `approve_film`, `refuse_film`, `dismiss_report`, **`approve_recruiter_edit`** (publie `bio_pending`), **`reject_recruiter_edit`** (jette le brouillon, garde la `bio`), **`grant_recruiter_verified`** / **`revoke_recruiter_verified`** (badge « recruteur vérifié »). Chaque action ecrit dans `admin_logs`. Autorisation : `profiles.is_admin` via service role.

## Observations

1. **Resend toujours non connecte** — aucun email transactionnel envoye (la dependance reste installee).
2. **`slugify()` est factorisee** dans `lib/utils.ts` (importee par signup, dashboard/projects, auth/callback). L'ancienne note « dupliquee » etait obsolete.
3. **Pas d'edit projet** — `/api/dashboard/projects` n'expose que GET/POST/DELETE.
4. **Routes publiques rate-limitees** (signup, waitlist) via `lib/rate-limit.ts` + RPC `check_rate_limit` — fail-open tant que la migration n'est pas appliquee.
5. **Deux flux d'invitation distincts** : `/api/invitations` (+`/claim`) = inviter **par email** un absent (chantier 10, `invitations` + ghost credit + Resend) ; `/api/invitations/project*` = inviter un **membre déjà inscrit** (`project_invitations`). L'éditeur d'équipe (MoiClient/DashboardClient) oriente vers l'un ou l'autre. **Resend** : actif dès que `RESEND_API_KEY` + `INVITE_FROM_EMAIL` sont renseignés ; sinon email sauté (invitation tout de même enregistrée).
6. **Statuts non contraints** — les statuts manipules par ces routes (`projects.status` via `/api/admin`, `credit_requests.status`, `project_invitations.status`, `reports.status`) sont des **colonnes TEXT libres sans `CHECK`/enum en base** : une valeur invalide n'est pas rejetee par Postgres. La validation repose entierement sur le code applicatif. Voir docs/database.md.
