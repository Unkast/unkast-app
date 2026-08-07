# Unkast — Routes API

> Regenere 2026-06-13 depuis le code (`src/app/api/**` + `src/app/(app)/auth/callback`), mis a jour
> le 2026-08-01. Le MVP documentait 6 routes ; le code en compte **35** (+ 1 route handler
> `auth/callback`).
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
| `/api/signup` | POST | — | `profiles`, `profile_roles`, `projects`, `project_credits`, `credit_requests` | rate-limit 5/IP/h ; **email à confirmer** (generateLink + Resend) |
| `/api/auth/resend-confirmation` | POST | — | — (Auth admin) | renvoie l'email de confirmation (Resend) ; rate-limit 3/h/email + 10/h/IP ; anti-énumération |
| `/api/waitlist` | POST | — | `waitlist` | rate-limit 5/IP/h |
| `/api/credits/status` | GET | `projects`, `project_credits`, `credit_requests` | — | auth optionnelle |

### Authentifie

| Route | Methodes | Tables lues | Tables ecrites |
|---|---|---|---|
| `/api/me` | GET | `profiles` (service role) | — |
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
**Garde commun `getActiveUser` ([lib/auth-guard.ts](../src/lib/auth-guard.ts))** : authentifie + **bloque les comptes suspendus** (`is_suspended`) côté serveur. Renvoie `user` (`id` + `email` Auth) et le profil (plan/account_type/full_name) pour mutualiser les lectures. Comble le trou de [`middleware.ts`](../src/lib/supabase/middleware.ts) ligne 64, dont la redirection des suspendus exclut explicitement `/api` : les **pages** étaient fermées, les **routes API** restaient ouvertes.

**Statuts renvoyés** (les handlers relaient `guard.status` et `guard.error` verbatim) :

| Statut | `error` | Cause |
|---|---|---|
| 401 | `Non authentifie.` | Pas de session. Inclut les pannes réseau vers le serveur Auth (`AuthRetryableFetchError` → `user: null`) |
| 403 | `Compte suspendu.` | `is_suspended = true` |
| 403 | `Profil introuvable. Contacte le support.` | `PGRST116` : utilisateur Auth **sans ligne `profiles`**. État permanent, pas transitoire |
| 503 | `Verification impossible, reessaie.` | La lecture de `profiles` a échoué : réseau, timeout, 5xx PostgREST, pool saturé, clé service role invalide |

> **Fail-closed (corrigé le 1er août 2026).** La lecture de `profiles` est le **seul** contrôle de suspension côté serveur. Le `error` de cette requête était jeté par la destructuration et le helper retombait sur un profil de secours `{ is_suspended: false, plan: null, … }` : il **affirmait « non suspendu »** au lieu de dire « je n'ai pas pu vérifier », donc un compte banni passait pendant toute la durée d'un incident base. L'erreur est désormais capturée, loguée (`[auth-guard]`) et convertie en variant non-200. Le profil de secours a disparu. **Ne pas réintroduire de valeur par défaut sur `is_suspended`.**
>
> Le 503 est distinct du 403 volontairement : réutiliser `« Compte suspendu. »` mentirait sur la cause et enverrait un utilisateur légitime vers `/suspended` pendant une panne. Le `PGRST116` est distinct du 503 pour la raison inverse : c'est permanent, un 503 ferait boucler le client. Origine connue d'un orphelin : compensation ratée dans `api/signup` (log `compensation deleteUser echouee`) ou suppression manuelle de la ligne. Un compte **Google** se répare seul au re-login (`auth/callback` recrée le profil) ; un compte **email/mot de passe** n'a aucun chemin automatique, la ligne `profiles` doit être recréée à la main. Côté front : afficher le message tel quel, **sans redirection** (sinon boucle).

> **Couverture (audit du 1er août 2026).** Le garde n'était branché que sur 10 handlers d'écriture ; l'audit en a trouvé **14 autres qui écrivaient sans aucun contrôle de suspension**. Tous corrigés. État actuel : **toute route API qui écrit en base et possède un utilisateur authentifié passe par `getActiveUser`**, sans exception non documentée ci-dessous.
>
> | Couverture | Routes |
> |---|---|
> | Garde d'origine | `messages` POST · `messages/conversation` POST · `reports` POST · `availability` POST/PATCH/DELETE · `invitations` POST · `recruitment/*` écritures (via `guard.ts` → `getProUser`/`getProWriter`) |
> | Ajouté le 01/08 | `avatar` POST/DELETE · `credits/request` POST · `credits/[id]` PATCH/DELETE · `dashboard/profile` PATCH · `dashboard/projects` POST/DELETE · `invitations/project` POST · `invitations/project/[id]` PATCH/DELETE · `messages/read` PATCH · `notifications/register` POST · `billing/checkout` POST |
>
> **Trois exceptions volontaires, à ne pas « corriger » :**
> - **`billing/portal` POST** reste ouvert aux suspendus. C'est la voie de résiliation d'abonnement (Stripe Customer Portal) : la fermer reviendrait à continuer de prélever un compte banni sans lui laisser de moyen d'arrêter.
> - **`logout` POST** reste ouvert (et n'écrit rien en base) : un suspendu doit pouvoir se déconnecter.
> - **`admin` PATCH** garde son propre helper `getAdminId()` (`lib/adminGuard.ts`, partagé avec le layout serveur de `/admin`) et **ne vérifie pas la suspension**. Ajouter le contrôle créerait un risque d'auto-blocage (unique admin suspendu par erreur → plus personne ne peut le réactiver). Le middleware bloque déjà la navigation vers `/admin`. Depuis le 07/08/2026, le risque est en plus réduit à la source : le PATCH **refuse l'auto-suspension** (`suspend_user` sur soi → 403, voir section `/api/admin`), et `reactivate_user` sur soi reste permis.
>
> Hors périmètre par nature : `billing/webhook` (signature Stripe, pas d'utilisateur), `signup` / `waitlist` / `auth/resend-confirmation` (publics). Les **GET restent volontairement non gardés** : un suspendu doit pouvoir consulter son compte et la page `/suspended` (qui appelle `api/me`).
- **Retrait de la vue publique** d'un suspendu (filtre applicatif `is_suspended IS NOT TRUE`, pas de RLS modifiée) : `recherche` (talents + films via owner), `feed` (talents + films), page `profil/[slug]` (→ 404), page `projet/[slug]` (→ 404 si propriétaire suspendu).
- **Rate-limit** (réutilise `checkRateLimit`, fail-open, clé = `user.id`) : `api/reports` (10/h), `api/availability` POST (30/h), `api/recruitment/*` écritures (60/h, via `getProWriter`).
- **Signalement en conversation** : `messages/[id]` ouvre le `ReportModal` ciblant le **profil de l'interlocuteur** (`target_type='profile'`, actionnable admin). Aucune route nouvelle.
- **Alerte prioritaire** : `api/admin` GET `tab=reports` trie par `total_reports` décroissant et ajoute `urgent: total_reports >= 3` ; l'UI admin remonte ces signalements en tête (marqueur « URGENT »). **Aucun blocage automatique** (décision : l'humain tranche).
- **Coordonnées** : le helper `getVisibleContactInfo` (mort) a été **supprimé** et les réglages `show_*_to` **masqués** dans l'UI (/moi, dashboard). Colonnes conservées en base. Les coordonnées ne sont pas affichées publiquement (contact **uniquement** via la messagerie Pro).

### /api/billing/* — paiement Stripe (chantier 7, mode TEST)
Abonnement Pro via **Stripe Checkout** (page hébergée). **Aucune donnée de carte stockée** — uniquement des IDs Stripe. Clés/secrets **uniquement en variables d'env** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `NEXT_PUBLIC_SITE_URL`).
- **`POST /api/billing/checkout`** `{ interval: 'monthly'|'yearly' }` : auth requise ; récupère/crée le Stripe Customer (persiste `stripe_customer_id`), crée une Checkout Session `mode:'subscription'` (`client_reference_id = user.id`, `success_url`/`cancel_url`) → renvoie `url`. **N'accorde pas** le Pro.
- **`POST /api/billing/webhook`** : **seule source de vérité**. Vérifie la signature (`STRIPE_WEBHOOK_SECRET`) sur le **raw body** (`req.text()`). Traite `checkout.session.completed`, `customer.subscription.created/updated/deleted`. Retrouve le profil par `stripe_customer_id` → `plan='pro'`/`'free'`, `subscription_status`, `current_period_end`, `pro_source='stripe'`. **Garde-fou** : ne touche jamais un profil sans `stripe_customer_id` ; ne rétrograde jamais `pro_source='admin'`.
  **Idempotence (audit fiabilité)** : `event.id` est revendiqué dans la table **`stripe_events`** AVANT toute écriture sur `profiles` — un événement rejoué → 200 `{duplicate:true}` sans traitement. Si le traitement échoue, la revendication est **libérée** + 500 (le retry Stripe rejouera) ; toutes les lectures/écritures du traitement sont vérifiées. Table absente (migration `20260702_stripe_events.sql` non exécutée) → traité sans dédup, loggé fort (le webhook ne casse pas selon l'ordre de déploiement).
- **`POST /api/billing/portal`** : auth requise ; ouvre le Stripe Customer Portal (résiliation, carte, mensuel↔annuel) → renvoie `url`.

> **Page `/pro`** : boutons d'achat (Mensuel/Annuel/« Gérer ») visibles si `NEXT_PUBLIC_BILLING_ENABLED === 'true'` **OU** visiteur `is_admin` (test) ; sinon **liste d'attente** publique (inchangée). Bandeau « mode test » tant que `BILLING_ENABLED` est `false`. Pages retour `/pro/success` & `/pro/cancel` (informatives — le Pro vient du webhook). Coexistence admin : `set_pro` et `approve_recruiter` posent `pro_source='admin'` (Pro à vie) sans toucher les `stripe_*`.

### POST /api/signup
Inscription complete : cree l'utilisateur Auth, insere le profil (`status='pending'`), les roles, et optionnellement un premier projet + credits + **`credit_requests`**. Rate-limit `signup:<ip>` (5/h). Slugs via `slugify()` partage (`lib/utils.ts`).
**Anti-énumération** : les erreurs de `generateLink` (dont « email déjà enregistré ») ne sont **jamais renvoyées brutes** — message générique côté client, erreur réelle loguée serveur (même posture que `/api/auth/resend-confirmation`).
**Compensation anti-orphelin (audit fiabilité)** : si l'insert du profil échoue après la création Auth, l'utilisateur Auth créé **par cette requête** est supprimé (`deleteUser`) pour libérer l'email — **jamais un compte préexistant** (critères cumulatifs : aucun profil en base pour cet id + email non confirmé + compte créé < 60 s, car `generateLink(type signup)` peut renvoyer un utilisateur existant non confirmé).
**Confirmation email obligatoire (chantier 12)** : le compte est créé **NON confirmé** via **`admin.generateLink({type:"signup"})`** (récupère `hashed_token`, **aucun email Supabase envoyé**). L'email de confirmation au branding Unkast part via **Resend** (`lib/email.ts` → `sendConfirmationEmail`, expéditeur `AUTH_FROM_EMAIL`), lien `/auth/confirm?token_hash=…&type=signup`. Réponse : `{ needs_confirmation: true, confirmation_sent }`. La page **`/auth/confirm`** fait `verifyOtp` (auto-login) → `/feed`. **Prérequis Supabase : « Confirm email » = ON** (bloque le login tant que non confirmé) + Redirect URL `/auth/confirm`. Renvoi via `/api/auth/resend-confirmation`.
**Anti-doublon vidéo (chantier 9)** : si le film fourni réutilise une vidéo déjà référencée (`video_key` identique), l'inscription **n'échoue pas** — le compte est créé, le **film est sauté**, et la réponse renvoie `{ video_skipped: true }` (l'UI `RejoindreClient` affiche un avertissement sur l'écran de confirmation). `video_key` est calculé via `extractVideoKey` et stocké à l'insert.
**Rattachement invitation (chantier 10)** : accepte `invitation_token`. Après création du profil, si le token est valide/pending/non expiré **ET** que `lower(email du compte) == lower(email invité)`, le **ghost credit** lié (`invitations.credit_id`) devient un vrai crédit (`profile_id` posé, `ghost_name` vidé), l'invitation passe `accepted`, push à l'inviteur. **Best-effort** : jamais d'échec global de l'inscription si le rattachement échoue ou si l'email diffère (anti-détournement).

### POST /api/dashboard/projects
Cree un projet. **Plafond plan-aware** (lu cote serveur) : **2 films si `plan = free`, 30 si `plan = pro`** (`MAX_PROJECTS_FREE` / `MAX_PROJECTS_PRO`). Champs requis : `title`, `category`, `video_url`. Insere projet + credit owner + credits ghost. 401 si non connecte. **Pas de PATCH/PUT** — un projet ne s'edite pas, seulement DELETE.
**Anti-doublon vidéo (chantier 9)** : calcule `video_key` (`extractVideoKey`) ; si une vidéo identique existe déjà → **409** `« Cette vidéo est déjà référencée sur Unkast. »`. Filet course : violation de l'index unique (`23505`) → même 409. `DashboardClient` / `MoiClient` affichent le message (toast) et **conservent le formulaire** pour correction.

### POST/DELETE /api/avatar
Upload / suppression de la photo de profil (Storage bucket `avatars`). **Pipeline image** : compression **navigateur** d'abord (`AvatarUpload` → canvas **512×512 WebP q0.8** ≈ 30–60 Ko, via `lib/image-compress.ts`) + **plafond d'entrée 10 Mo** côté client. **Garde-fou serveur** : type ∈ {jpeg,png,webp} + **taille ≤ 3 Mo** (vrai rempart anti-saturation, valide avant chargement en mémoire). Stocke `${user.id}/avatar.webp` (`upsert`), supprime l'ancien `avatar.jpg` legacy, met à jour `profiles.avatar_url` (`+ ?t=timestamp`). DELETE retire `.webp` + `.jpg` et remet `avatar_url` à null. *(Les affiches `poster_url`/`preview_url` ne sont PAS uploadées par l'utilisateur — `lib/image-compress.ts` est prêt à les couvrir le jour où la feature sera ajoutée.)*

### GET /api/me
Statut du visiteur sur **son propre** compte : `{ is_admin, plan, suspended_reason }`. Authentifie via le client utilisateur (cookies de session), puis lit ces colonnes via **`createAdminClient()`** scope sur `user.id` — `is_admin` et `suspended_reason` font partie des **14 colonnes revoquees** pour `anon`/`authenticated` (voir [database.md](database.md#row-level-security-rls)) et ne sont plus lisibles depuis le navigateur. **Volontairement sans `getActiveUser`** : la page `/suspended` doit rester consultable par un compte suspendu. Consommee par `pro/page.tsx` et `suspended/page.tsx`. 401 si non connecte.

### GET /api/dashboard/profile
**Lecture en deux temps**, contrat inchange (l'objet renvoye porte toujours les 45 cles du type `Profile`) : les 31 colonnes de `OWN_COLUMNS` via le **client utilisateur** (c'est la RLS qui garantit qu'on ne lit que sa propre ligne), les 14 de `PRIVILEGED_COLUMNS` (revoquees en base) via le **client de confiance**, scope sur `user.id`, puis fusion. Si la lecture protegee echoue → **500**, jamais un profil ampute (un objet sans `bio_pending` se lirait a tort comme « aucune modification en attente »).

### PATCH /api/dashboard/profile
Met a jour le profil. **Double client d'ecriture** : les colonnes editables par l'utilisateur (nom, bio, localisation, liens, **coordonnees**, `show_*_to`…) sont ecrites via le **client utilisateur** (RLS) ; les **5 colonnes systeme** (`account_type`, `is_recruiting`, `recruiting_roles`, `bio_pending`, `recruiter_review_status`) sont ecrites via **`createAdminClient()`** (service role) dans un **update separe**, uniquement si l'une d'elles change. L'authentification reste sur le client utilisateur (`getUser`). Chaque ecriture verifie `error` — en cas d'echec, erreur explicite (pas de succes partiel silencieux), y compris si le delete des `profile_roles` reussit mais que le re-insert echoue.

> **`contact_email` / `contact_phone` restent sur le client utilisateur** malgre leur presence dans `PRIVILEGED_COLUMNS` : elles sont revoquees en **SELECT** pour `anon`/`authenticated`, mais **accordees en UPDATE**. L'ecriture ne demande donc aucun privilege de lecture, a une condition verifiee dans postgrest-js 2.99.2 : `Prefer: return=representation` n'est ajoute que par `.select()`, et l'update de cette route n'en chaine pas. La reponse est un 204 sans `RETURNING`. **Si un jour on chaine `.select()` sur cet update**, PostgREST renverra 403 sur les colonnes retournees : la correction sera alors de retirer ces deux colonnes du retour, **pas** de changer de client.
**Validation `recruiting_roles`** : non-tableau → `[]` ; valeurs filtrees sur `ALL_ROLES` (`lib/constants.ts`), dedoublonnees, plafonnees a **20**.
**Badge « Je recrute »** : `is_recruiting` / `recruiting_roles` ne sont ecrits **que si `plan = pro` ET `account_type ∈ {creator, recruiter}`** (verification serveur, sur le role EFFECTIF). Sinon forces a `false`/`[]` — un talent ou un compte gratuit ne peut pas l'activer, meme par appel API direct.
**Changement de role** : `account_type` accepte **uniquement les bascules `talent ↔ creator`**. Toute autre transition (vers/depuis `recruiter`) → **403** (le Pro recruteur reste attribue par l'admin a la validation). Une bascule `creator → talent` nettoie automatiquement le badge « Je recrute ». Le `plan` n'est jamais modifie par cette route.
**Description pro d'un recruteur (chantier 2)** : si `account_type='recruiter'` et que `bio` change, la nouvelle valeur va dans **`bio_pending`** + `recruiter_review_status='pending'` (la `bio` publique n'est PAS touchee) ; la reponse renvoie `{ pendingReview: true }`. Pour les autres comptes, `bio` est publiee directement. Les champs anodins (avatar, localisation, liens, coordonnees) restent en publication directe.

### POST /api/invitations  &  GET /api/invitations/claim  (chantier 10 — invitation email)
**POST** : inviter par email un collaborateur **absent** d'Unkast. Garde-fous : `getActiveUser` (bloque suspendus) + **`creator` uniquement** ; **projet possédé** par l'inviteur (sinon 403) ; **invitation toujours liée à un crédit réel** — crée le **ghost credit** (`project_credits.ghost_name`) puis l'`invitations` dans le même appel ; **double rate-limit** `invite:<userId>` (5/j) **et** `invite:global` (200/j) → **429** ; unicité (email, projet) → **409** « déjà invitée sur ce film » (avec rollback du ghost credit) ; **envoi via Resend uniquement** (`lib/email.ts`), **sauté proprement en dev sans `RESEND_API_KEY`** → réponse `{ success, email_sent }`. Body : `{ project_id, email, role, name? }`.
**GET /claim?token=** : résout une invitation pour pré-remplir l'inscription. **Anti-énumération** : renvoie `{ valid:false }` générique si token absent/invalide/expiré/déjà consommé ; sinon `{ valid:true, email, role, project_title }` (l'email sert à pré-remplir **et verrouiller** le champ dans `RejoindreClient`).

### /api/messages (POST)
Envoi de message / creation de conversation. Regles metier code-verifiees :
- Max **5** nouvelles conversations / jour pour l'initiateur — quota factorise dans **`lib/messaging.ts`** (`DAILY_CONVERSATION_LIMIT` + `countConversationsInitiatedToday`), consomme par cette route, par `/api/messages/conversation` POST et par `/api/messages/daily-count` (une seule source de verite).
- Blocage des coordonnees (regex) tant que `< 3` messages echanges.
- Relance impossible avant **48 h** si pas de reponse.

### /api/messages/conversation (POST)
Cree (ou retrouve) une conversation sans envoyer de message — utilise par le bouton contact de `profil/[slug]` et par l'espace recrutement. **Alignee sur les gardes de `/api/messages` POST** : `getActiveUser` (401 non connecte, **403 compte suspendu**), Pro requis (403 + `redirect:/pro`), et **meme quota journalier** de 5 nouvelles conversations (helper partage `lib/messaging.ts`) → **429** avec message lisible dans `error`. Retrouver une conversation existante ne consomme pas le quota.

### /api/admin (GET, PATCH)
Back-office complet (contredit l'ancienne note « pas de route admin »). GET par onglet : `recruiters` (renvoie aussi `edits` = descriptions pro en attente de re-validation), `reports` (trié par `total_reports` décroissant + flag `urgent` à ≥3), `users`, `films`. PATCH actions : `approve_recruiter`, `reject_recruiter`, `suspend_user`, `reactivate_user`, `set_pro`, `approve_film`, `refuse_film`, `dismiss_report`, **`approve_recruiter_edit`** (publie `bio_pending`), **`reject_recruiter_edit`** (jette le brouillon, garde la `bio`), **`grant_recruiter_verified`** / **`revoke_recruiter_verified`** (badge « recruteur vérifié »). Chaque action ecrit dans `admin_logs`. Autorisation : `profiles.is_admin` via service role — helper unique `getAdminId()` (`lib/adminGuard.ts`), partagé avec la garde serveur de `src/app/admin/layout.tsx` (l'espace `/admin` vit hors du groupe `(app)` depuis le 07/08/2026).
**Fiabilité (audit)** : chaque écriture (métier ET journal `admin_logs`) est **vérifiée** — échec métier → 500 « Échec de l'action … », journal en échec → 500 « Action … appliquée, mais journal admin non écrit ». `approve_recruiter_edit` refuse de publier si la lecture du brouillon échoue (sinon `bio` serait écrasée par `null`). ⚠️ `AdminClient` (front) n'affiche pas encore ces erreurs (toast « Action effectuee » systématique) — retouche front à prévoir.
**Auto-protection (07/08/2026)** : le PATCH refuse (**403** « Auto-protection : un admin ne peut pas appliquer cette action à son propre compte. », message distinct du 403 « Compte suspendu. ») les actions `suspend_user`, `reject_recruiter` et `revoke_recruiter_verified` quand `target_id` = l'admin appelant. La tentative est journalisée dans `admin_logs` (`action='self_action_blocked'`, `details.attempted_action`), en best-effort (le refus tient même si le log échoue). Décisions produit associées : `reactivate_user` sur soi reste **permis** (porte de sortie) ; les actions « avantage à soi » (`approve_recruiter`, `set_pro`, `grant_recruiter_verified`, `approve_recruiter_edit`, `reject_recruiter_edit`) restent **permises** (admin unique — les bloquer imposerait du SQL manuel ; `set_pro` sur soi sert au test billing) ; `approve_film`/`refuse_film`/`dismiss_report` visant un contenu de l'admin : **hors périmètre** (même raison, à revoir si un second modérateur arrive).

## Observations

1. **Resend toujours non connecte** — aucun email transactionnel envoye (la dependance reste installee).
2. **`slugify()` est factorisee** dans `lib/utils.ts` (importee par signup, dashboard/projects, auth/callback). L'ancienne note « dupliquee » etait obsolete.
3. **Pas d'edit projet** — `/api/dashboard/projects` n'expose que GET/POST/DELETE.
4. **Routes publiques rate-limitees** (signup, waitlist) via `lib/rate-limit.ts` + RPC `check_rate_limit` — **fail-closed** : une erreur RPC refuse la requete (429) et est loguee. Seule la RPC *absente* (migration non executee) hors production reste autorisee, pour le dev local.
5. **Deux flux d'invitation distincts** : `/api/invitations` (+`/claim`) = inviter **par email** un absent (chantier 10, `invitations` + ghost credit + Resend) ; `/api/invitations/project*` = inviter un **membre déjà inscrit** (`project_invitations`). L'éditeur d'équipe (MoiClient/DashboardClient) oriente vers l'un ou l'autre. **Resend** : actif dès que `RESEND_API_KEY` + `INVITE_FROM_EMAIL` sont renseignés ; sinon email sauté (invitation tout de même enregistrée).
6. **Body JSON malformé → 400 uniforme** — toutes les routes à body passent par `readJsonBody()` + `invalidBodyResponse()` (**`lib/api.ts`**) : body absent/malformé/non-objet → **400** `{ error: "Corps de requête invalide." }` (avant : 500 brut sur `request.json()`).
7. **Statuts non contraints** — les statuts manipules par ces routes (`projects.status` via `/api/admin`, `credit_requests.status`, `project_invitations.status`, `reports.status`) sont des **colonnes TEXT libres sans `CHECK`/enum en base** : une valeur invalide n'est pas rejetee par Postgres. La validation repose entierement sur le code applicatif. Voir docs/database.md.
