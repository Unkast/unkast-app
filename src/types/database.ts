// =============================================================================
// src/types/database.ts
// =============================================================================
// Source de verite : schema reel Supabase (projet unkast-app), introspecte via
// information_schema.columns le 13/06/2026.
//
// Ce fichier decrit la base TELLE QU'ELLE EXISTE en prod, pas le modele souhaite.
// Les colonnes texte libres (account_type, plan, etc.) sont typees en union TS
// pour la lisibilite, MAIS la base ne contraint PAS ces valeurs (voir NOTES).
// =============================================================================

// -----------------------------------------------------------------------------
// ENUMS POSTGRES REELS (les 4 seuls enums applicatifs)
// -----------------------------------------------------------------------------
export type ProfileStatus = 'pending' | 'approved' | 'rejected'
export type ProjectCategory =
  | 'court-metrage'
  | 'moyen-metrage'
  | 'long-metrage'
  | 'publicite'
  | 'clip'
  | 'documentaire'
  | 'bande-demo'
  | 'scene-extrait'
export type ContactSubject = 'collaboration' | 'project' | 'question' | 'other'
export type ContactStatus = 'pending' | 'accepted' | 'declined'

// -----------------------------------------------------------------------------
// "PSEUDO-ENUMS" : colonnes TEXT libres en base, typees ici pour confort.
// ATTENTION : aucune contrainte CHECK / enum cote Postgres. Une valeur hors
// de ces unions PEUT exister en base. Voir NOTES (dette technique).
// -----------------------------------------------------------------------------

// account_type = ROLE (independant du plan). Valeurs canoniques contraintes par
// le CHECK `profiles_account_type_check` en base. Defaut 'talent'. 'member' supprime
// du modele (migre vers 'talent'). Regle metier : recruiter => plan 'pro' (cote code).
export type AccountType = 'talent' | 'creator' | 'recruiter'

// plan : 'free'/'pro'. 'pro' accordable manuellement (admin) ou par abonnement Stripe.
export type Plan = 'free' | 'pro' | (string & {})

// pro_source : GELEE (2026-08-10, chantier grants). Plus jamais ecrite ni lue
// par le code applicatif — remplacee par pro_grant_type (Pro offert admin,
// independant de Stripe) + subscription_status (Stripe). Colonne conservee en
// base (pas de DROP), `DROP` prevu dans un commit dedie post-lancement. Type
// garde ici pour la lecture d'anciennes lignes admin_logs/donnees, pas pour
// une ecriture nouvelle.
export type ProSource = 'stripe' | 'admin' | (string & {})

// pro_grant_type : nature du Pro OFFERT par l'admin, independant de Stripe
// (colonnes stripe_*/subscription_status). CHECK strict en base
// (profiles_pro_grant_type_check) — contrairement a la plupart des colonnes
// TEXT libres de ce fichier, une valeur hors union ne PEUT PAS exister.
// 'launch' = cadeau de lancement, echeance obligatoire. 'vip' = choix
// explicite, echeance libre (null = a vie). null = aucun grant. Regles
// d'echeance imposees par le CHECK profiles_pro_grant_expiry_check (migration
// 20260810_pro_grants.sql) et dupliquees cote TS dans lib/pro-plan.ts
// (validateGrantExpiry) — ce dernier fichier definit sa PROPRE union
// 'launch'|'vip' (sans null), utilisee pour typer un grant present, distincte
// de ce type-ci qui couvre aussi son absence. `plan` reste la porte effective
// lue partout dans le code ; elle est desormais DERIVEE (plan='pro' <=>
// abonnement Stripe actif OU grant valide), calculee par la RPC
// recompute_plan — plus jamais ecrite directement par le webhook ni les
// actions admin.
//
// ⚠️ Un troisieme type, 'recruiter' (lie au statut recruteur approuve, pose
// uniquement par approve_recruiter, jamais d'echeance), a existe du
// 2026-08-10 (creation) au meme jour (retrait, nouveau modele economique —
// approve_recruiter ne donne plus le Pro). Stock purge, CHECK resserre —
// voir supabase/migrations/20260810_pro_grants_type_cleanup.sql.
export type ProGrantType = 'launch' | 'vip' | null

// recruiter_status : toujours null en prod. Valeurs probables cote code admin.
export type RecruiterStatus = 'pending' | 'approved' | 'rejected' | null

// recruiter_review_status : statut de re-verification de la description pro
// (modif sensible). CHECK strict en base (profiles_recruiter_review_status_check).
export type RecruiterReviewStatus = 'none' | 'pending' | 'rejected'

// display_name_preference : 'real_name' | 'stage_name' presents en prod.
export type DisplayNamePreference = 'real_name' | 'stage_name' | (string & {})

// show_*_to : visibilite par audience. 'nobody' | 'pro_users' presents en prod.
// Defaut 'nobody'. Autres valeurs probables : 'everyone', 'free_users'...
export type VisibilityAudience = 'nobody' | 'pro_users' | 'everyone' | (string & {})

// statuts texte libres sur les tables d'invitation / credits.
export type CreditRequestStatus = 'pending' | 'accepted' | 'declined' | (string & {})
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | (string & {})

// projects.status : colonne TEXT libre (pas un enum Postgres). Le code filtre
// sur 'approved' (.eq("projects.status","approved")). Workflow de moderation
// des films : valeurs probables 'pending' | 'approved' | 'refused'.
export type ProjectStatus = 'pending' | 'approved' | 'refused' | (string & {})

// reports.status / waitlist.status : colonnes TEXT libres, defaut 'pending'.
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed' | (string & {})
export type WaitlistStatus = 'pending' | 'invited' | 'accepted' | (string & {})

// -----------------------------------------------------------------------------
// TABLE : profiles  (35 colonnes)
// -----------------------------------------------------------------------------
export interface Profile {
  // --- Coeur (origine MVP) ---
  id: string
  full_name: string
  slug: string
  bio: string | null
  avatar_url: string | null
  location: string | null
  is_available: boolean | null
  status: ProfileStatus | null
  created_at: string | null
  updated_at: string | null

  // --- Compte / plan ---
  account_type: AccountType | null   // defaut 'talent'
  plan: Plan | null                  // defaut 'free'
  pro_since: string | null
  is_admin: boolean | null           // defaut false

  // --- Abonnement Stripe (chantier 7). Souverain sur ces 4 colonnes ; plan/
  // pro_since sont desormais DERIVEES (voir pro_grant_type ci-dessous et RPC
  // recompute_plan). Aucune donnee de carte. ---
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null   // statut Stripe brut (active/canceled/past_due...)
  current_period_end: string | null
  pro_source: ProSource | null         // GELEE (2026-08-10) — voir commentaire du type ProSource

  // --- Pro offert (grant admin), independant de Stripe — chantier grants,
  // migration 20260810_pro_grants.sql. Voir commentaire du type ProGrantType. ---
  pro_grant_type: ProGrantType
  pro_grant_expires_at: string | null
  pro_grant_granted_by: string | null        // FK -> profiles(id), ON DELETE SET NULL
  pro_grant_granted_at: string | null
  pro_grant_reminder_sent_at: string | null  // rappel J-7 envoye avec succes (cron, chantier ulterieur)

  // --- Recruteur (workflow d'approbation) ---
  recruiter_status: RecruiterStatus
  recruiter_company: string | null
  recruiter_role: string | null
  recruiter_website: string | null
  recruiter_document_url: string | null

  // --- Recruteur : credibilite / re-verification (chantier 2) ---
  // bio = version PUBLIQUE validee ; bio_pending = modif sensible en attente.
  bio_pending: string | null
  recruiter_verified: boolean | null              // defaut false — badge "verifie"
  recruiter_verified_at: string | null
  recruiter_review_status: RecruiterReviewStatus | null  // defaut 'none'
  recruiter_review_reason: string | null  // motif du dernier refus (admin) ; null hors etat 'rejected'

  // --- Suspension (moderation) ---
  is_suspended: boolean | null       // defaut false
  suspended_at: string | null
  suspended_reason: string | null

  // --- Identite / nommage ---
  first_name: string | null
  last_name: string | null
  stage_name: string | null
  display_name_preference: DisplayNamePreference | null  // defaut 'real_name'

  // --- Contact ---
  contact_email: string | null
  contact_phone: string | null
  instagram_url: string | null
  website_url: string | null

  // --- Confidentialite (visibilite par audience) ---
  show_contact_email_to: VisibilityAudience | null  // defaut 'nobody'
  show_phone_to: VisibilityAudience | null          // defaut 'nobody'
  show_real_name_to: VisibilityAudience | null      // defaut 'nobody'

  // --- Recrutement ("Je recrute") ---
  is_recruiting: boolean | null      // defaut false
  recruiting_roles: string[] | null  // defaut '{}' (text[])
  is_looking_for: string | null
}

// -----------------------------------------------------------------------------
// TABLE : profile_roles
// -----------------------------------------------------------------------------
export interface ProfileRole {
  id: string
  profile_id: string
  role_name: string
}

// -----------------------------------------------------------------------------
// TABLE : projects  (12 colonnes)
// -----------------------------------------------------------------------------
export interface Project {
  id: string
  profile_id: string
  title: string
  slug: string
  description: string | null
  category: ProjectCategory
  year: number
  video_url: string
  video_key: string | null       // identifiant canonique "youtube:<id>"/"vimeo:<id>" — anti-doublon (chantier 9)
  created_at: string | null
  status: ProjectStatus | null   // text libre, defaut probable 'pending'
  poster_url: string | null
  preview_url: string | null
}

// -----------------------------------------------------------------------------
// TABLE : project_credits
// -----------------------------------------------------------------------------
export interface ProjectCredit {
  id: string
  project_id: string
  profile_id: string | null
  ghost_name: string | null
  role_on_project: string
}

// -----------------------------------------------------------------------------
// TABLE : contact_requests
// -----------------------------------------------------------------------------
export interface ContactRequest {
  id: string
  from_name: string
  from_email: string
  to_profile_id: string
  subject: ContactSubject
  message: string
  status: ContactStatus | null
  created_at: string | null
}

// -----------------------------------------------------------------------------
// TABLE : conversations
// -----------------------------------------------------------------------------
export interface Conversation {
  id: string
  participant_1: string
  participant_2: string
  last_message_at: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : messages
// -----------------------------------------------------------------------------
export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean | null
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : credit_requests
// -----------------------------------------------------------------------------
export interface CreditRequest {
  id: string
  project_id: string
  requester_id: string
  role: string
  message: string | null
  status: CreditRequestStatus
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : invitations  (invitation par email + token — chantier 10)
// -----------------------------------------------------------------------------
export interface Invitation {
  id: string
  project_id: string
  email: string
  role: string
  token: string                  // uuid (usage unique du lien d'invitation)
  credit_id: string | null       // FK -> project_credits (ghost credit lié), ON DELETE CASCADE
  inviter_id: string | null      // FK -> profiles (le createur qui invite)
  status: InvitationStatus       // 'pending' | 'accepted' | 'expired'
  expires_at: string             // defaut now() + 30 jours
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : project_invitations  (invitation d'un profil existant)
// -----------------------------------------------------------------------------
export interface ProjectInvitation {
  id: string
  project_id: string
  invited_profile_id: string
  inviter_id: string
  role: string
  message: string | null
  status: InvitationStatus
  created_at: string | null
}

// -----------------------------------------------------------------------------
// TABLE : admin_logs  (journal des actions admin)
// -----------------------------------------------------------------------------
export interface AdminLog {
  id: string
  admin_id: string
  action: string
  target_type: string
  target_id: string | null
  details: Record<string, unknown> | null  // jsonb
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : push_tokens  (tokens notifications push, par profil)
// -----------------------------------------------------------------------------
export interface PushToken {
  id: string
  profile_id: string
  token: string
  platform: string  // defaut 'android'
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : rate_limits  (compteur de limitation de debit, cle = no PK uuid)
// -----------------------------------------------------------------------------
export interface RateLimit {
  key: string
  count: number       // defaut 0
  window_start: string
}

// -----------------------------------------------------------------------------
// TABLE : reports  (signalements moderes par un admin)
// -----------------------------------------------------------------------------
export interface Report {
  id: string
  reporter_id: string
  target_type: string
  target_id: string
  reason: string
  description: string | null
  status: ReportStatus  // defaut 'pending'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : waitlist  (liste d'attente / inscriptions interet)
// -----------------------------------------------------------------------------
export interface Waitlist {
  id: string
  email: string
  type: string
  name: string | null
  company: string | null
  message: string | null
  status: WaitlistStatus  // defaut 'pending'
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : availability_signals  (recrutement — signal "Disponible")
// Un talent (ou creator non-recruteur) se signale disponible pour UN poste chez
// UN recruteur. Unicite (talent_id, recruiter_id, role). expires_at = +30j,
// prolongeable. On garde les lignes expirees (filtre expires_at > now()).
// -----------------------------------------------------------------------------
export interface AvailabilitySignal {
  id: string
  talent_id: string
  recruiter_id: string
  role: string
  created_at: string
  expires_at: string
}

// -----------------------------------------------------------------------------
// TABLE : recruiter_folders  (recrutement — dossiers-films prives du recruteur)
// Invisibles des talents (RLS : recruiter_id = auth.uid() uniquement).
// -----------------------------------------------------------------------------
export interface RecruiterFolder {
  id: string
  recruiter_id: string
  name: string
  created_at: string
}

// -----------------------------------------------------------------------------
// TABLE : folder_candidates  (recrutement — rangement d'un candidat dans un dossier)
// snapshot talent_id + role (survit a l'expiration du signal). signal_id =
// provenance optionnelle (ON DELETE SET NULL).
// -----------------------------------------------------------------------------
export interface FolderCandidate {
  id: string
  folder_id: string
  talent_id: string
  role: string
  signal_id: string | null
  added_at: string
}

// -----------------------------------------------------------------------------
// TABLE : recruiter_dismissals  (recrutement — ecartement silencieux, par poste)
// Table separee (jamais lisible par le talent) => invisibilite structurelle.
// -----------------------------------------------------------------------------
export interface RecruiterDismissal {
  id: string
  recruiter_id: string
  talent_id: string
  role: string
  created_at: string
}

// =============================================================================
// NOTES / DETTE TECHNIQUE (a traiter, hors scope de cette resync)
// =============================================================================
// 1. account_type ET plan sont desormais contraints par CHECK en base
//    (profiles_account_type_check, profiles_plan_check). Les AUTRES colonnes
//    "pseudo-enum" (recruiter_status, display_name_preference, show_*_to,
//    statuts d'invitation/credits/reports/waitlist) restent des TEXT LIBRES
//    sans contrainte => a terme : enums Postgres ou CHECK.
//
// 2. account_type = ROLE (talent/creator/recruiter), tranche : 'member' supprime
//    (migre vers 'talent'). plan = free/pro, independant du role.
//    Regle metier "recruiter => plan 'pro'" : geree cote code (souplesse essai
//    gratuit / recruteur en cours de validation), volontairement pas de CHECK.
//
// 3. is_looking_for et recruiter_* sont entierement null en prod : colonnes
//    creees mais jamais alimentees. Verifier si le code les ecrit vraiment.
//
// 4. Toutes les tables applicatives reelles sont desormais typees (19 tables) :
//    5 d'origine + conversations, messages, credit_requests, invitations,
//    project_invitations, admin_logs, push_tokens, rate_limits, reports,
//    waitlist + recrutement (availability_signals, recruiter_folders,
//    folder_candidates, recruiter_dismissals). Les tables internes Supabase
//    (auth.*, storage.*) sont hors scope.
// =============================================================================
