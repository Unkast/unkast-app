import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { sendPushToUser } from "@/lib/push";
import { ALL_ROLES } from "@/lib/constants";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// recruiting_roles arrive librement du client : on ne garde que des roles
// connus (ALL_ROLES), dedoublonnes, plafonnes a 20 entrees.
function sanitizeRecruitingRoles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const valid = input.filter((r) => typeof r === "string" && ALL_ROLES.includes(r));
  return [...new Set(valid)].slice(0, 20);
}

// Lecture du profil en DEUX temps (le contrat renvoye au front est inchange :
// c'est toujours l'objet complet du type Profile de src/types/database.ts).
//
// OWN_COLUMNS : colonnes lues via le CLIENT UTILISATEUR (RLS) — c'est aussi ce
// qui garantit que l'appelant ne lit que sa propre ligne.
// PRIVILEGED_COLUMNS : colonnes REVOQUEES en base pour anon/authenticated ;
// elles ne peuvent plus transiter par le client utilisateur et sont lues via le
// client de confiance (service role), scope sur user.id.
//
// Toute colonne nouvellement revoquee doit MIGRER de OWN_COLUMNS vers
// PRIVILEGED_COLUMNS : sinon PostgREST refusera la lecture (permission denied).
const OWN_COLUMNS = [
  "id", "full_name", "slug", "bio", "avatar_url", "location", "is_available",
  "status", "created_at", "updated_at",
  "account_type", "plan", "pro_since",
  "recruiter_company", "recruiter_role", "recruiter_website",
  "recruiter_verified", "recruiter_verified_at",
  "is_suspended",
  "first_name", "last_name", "stage_name", "display_name_preference",
  "instagram_url", "website_url",
  "show_contact_email_to", "show_phone_to", "show_real_name_to",
  "is_recruiting", "recruiting_roles", "is_looking_for",
].join(", ");

// Liste EXACTE des 17 colonnes revoquees pour anon/authenticated LUES ICI.
// (14 de la migration 20260731 + recruiter_review_reason (20260807) +
// pro_grant_type/pro_grant_expires_at (20260810) — ces deux derniers pour que
// /pro et MoiClient affichent l'origine/echeance d'un Pro offert au proprietaire
// du profil. Les 3 AUTRES colonnes pro_grant_* (granted_by, granted_at,
// reminder_sent_at) restent VOLONTAIREMENT hors de cette liste : details
// d'audit admin (qui a accorde, quand un rappel est parti), pas des
// informations que l'utilisateur doit lire sur son propre profil — l'objet
// renvoye ne porte donc plus les 51 colonnes de `profiles`, seulement 48.)
const PRIVILEGED_COLUMNS = [
  "is_admin",
  "contact_email", "contact_phone",
  "recruiter_status", "recruiter_document_url", "recruiter_review_status", "bio_pending",
  "recruiter_review_reason",
  "suspended_at", "suspended_reason",
  "pro_source",
  "stripe_customer_id", "stripe_subscription_id", "subscription_status", "current_period_end",
  "pro_grant_type", "pro_grant_expires_at",
].join(", ");

// GET: fetch current user's profile with roles
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(OWN_COLUMNS)
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

  // Colonnes protegees : client de confiance, scope sur la ligne de l'appelant.
  const admin = createAdminClient();
  const { data: privileged, error: privilegedError } = await admin
    .from("profiles")
    .select(PRIVILEGED_COLUMNS)
    .eq("id", user.id)
    .single();

  // Echec ici = profil ampute (coordonnees / statut de re-validation absents).
  // Erreur explicite plutot qu'un objet incomplet que le front interpreterait
  // comme "aucune modification en attente".
  if (privilegedError || !privileged) {
    return NextResponse.json(
      { error: "Lecture du profil incomplete. Reessaie dans un instant." },
      { status: 500 }
    );
  }

  const { data: roles } = await supabase
    .from("profile_roles")
    .select("*")
    .eq("profile_id", user.id);

  // Cast : le parseur de types de supabase-js ne sait pas inferer une liste de
  // colonnes construite dynamiquement (OWN_COLUMNS / PRIVILEGED_COLUMNS).
  const merged = {
    ...(profile as unknown as Record<string, unknown>),
    ...(privileged as unknown as Record<string, unknown>),
  };

  return NextResponse.json({ profile: merged, roles: roles ?? [] });
}

// PATCH: update profile
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  // Le GET reste sur getUser seul : un suspendu doit pouvoir consulter son profil.
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { account_type, full_name, first_name, last_name, stage_name, display_name_preference, bio, location, is_available, avatar_url, roles, contact_email, contact_phone, instagram_url, website_url, show_contact_email_to, show_phone_to, show_real_name_to, is_recruiting, recruiting_roles } = body;

  // Plan + role + bio courants (verif serveur).
  const { data: me } = await supabase
    .from("profiles")
    .select("plan, account_type, bio")
    .eq("id", user.id)
    .single();

  // Bascule de role par l'utilisateur : UNIQUEMENT talent <-> creator.
  // Passer a/depuis 'recruiter' est INTERDIT par cette voie (403) — sinon
  // auto-attribution du Pro ; le parcours recruteur reste la validation admin.
  let effectiveAccountType = me?.account_type ?? null;
  if (account_type !== undefined && account_type !== me?.account_type) {
    const SELF_SWITCHABLE = ["talent", "creator"];
    if (!SELF_SWITCHABLE.includes(account_type) || !SELF_SWITCHABLE.includes(me?.account_type ?? "")) {
      return NextResponse.json({ error: "Changement de role non autorise." }, { status: 403 });
    }
    effectiveAccountType = account_type;
  }

  // Eligibilite badge "Je recrute" : Pro + role createur/recruteur, evaluee sur
  // le role EFFECTIF (apres une eventuelle bascule). Verification cote SERVEUR.
  const canRecruit =
    me?.plan === "pro" &&
    (effectiveAccountType === "creator" || effectiveAccountType === "recruiter");

  // Deux updates separes : `updates` = colonnes editables par l'utilisateur,
  // ecrites via le client utilisateur (RLS). `systemUpdates` = colonnes systeme
  // (account_type, is_recruiting, recruiting_roles, bio_pending,
  // recruiter_review_status), ecrites via le client de confiance (service role)
  // car la regle base a venir en refusera l'ecriture au client utilisateur.
  const updates: Record<string, unknown> = {};
  const systemUpdates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (stage_name !== undefined) updates.stage_name = stage_name;
  if (display_name_preference !== undefined) updates.display_name_preference = display_name_preference;
  // Description pro d'un recruteur = champ SENSIBLE : toute modif part en attente
  // de validation admin (bio_pending), le public continue de voir `bio` validee.
  // Pour les autres comptes (talent/creator), publication directe comme avant.
  let pendingReview = false;
  if (bio !== undefined) {
    const isRecruiter = effectiveAccountType === "recruiter";
    if (isRecruiter && (bio ?? null) !== (me?.bio ?? null)) {
      systemUpdates.bio_pending = bio;
      systemUpdates.recruiter_review_status = "pending";
      // Nouvelle soumission : le motif d'un eventuel refus precedent est perime.
      systemUpdates.recruiter_review_reason = null;
      pendingReview = true;
    } else {
      updates.bio = bio;
    }
  }
  if (location !== undefined) updates.location = location;
  if (is_available !== undefined) updates.is_available = is_available;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;
  // contact_email / contact_phone : REVOQUEES en SELECT pour anon/authenticated
  // (d'ou leur presence dans PRIVILEGED_COLUMNS a la lecture) mais ACCORDEES en
  // UPDATE. Elles restent donc des champs editables ordinaires, ecrits par le
  // client utilisateur. Ne pas les basculer sur le client de confiance : l'update
  // n'a pas de .select() chaine, donc aucune representation n'est renvoyee et
  // aucun privilege SELECT n'est exerce sur ce qu'on ecrit.
  if (contact_email !== undefined) updates.contact_email = contact_email;
  if (contact_phone !== undefined) updates.contact_phone = contact_phone;
  if (instagram_url !== undefined) updates.instagram_url = instagram_url;
  if (website_url !== undefined) updates.website_url = website_url;
  if (show_contact_email_to !== undefined) updates.show_contact_email_to = show_contact_email_to;
  if (show_phone_to !== undefined) updates.show_phone_to = show_phone_to;
  if (show_real_name_to !== undefined) updates.show_real_name_to = show_real_name_to;
  // N'ecrit is_recruiting/recruiting_roles QUE si l'utilisateur est eligible.
  // Si non eligible, on force a false pour nettoyer un eventuel etat legacy
  // (ex. un createur Pro retrograde en free ne doit plus apparaitre "Je recrute").
  if (is_recruiting !== undefined) {
    if (canRecruit) {
      systemUpdates.is_recruiting = is_recruiting;
      systemUpdates.recruiting_roles = is_recruiting ? sanitizeRecruitingRoles(recruiting_roles) : [];
    } else {
      systemUpdates.is_recruiting = false;
      systemUpdates.recruiting_roles = [];
    }
  }

  // Bascule de role (deja validee talent<->creator plus haut).
  if (account_type !== undefined && account_type !== me?.account_type) {
    systemUpdates.account_type = account_type;
    // Si le nouveau role rend le compte ineligible (ex. creator -> talent),
    // on nettoie le badge "Je recrute" meme si is_recruiting n'est pas envoye.
    if (!canRecruit) {
      systemUpdates.is_recruiting = false;
      systemUpdates.recruiting_roles = [];
    }
  }

  // Auto-sync full_name from first_name + last_name
  if (first_name !== undefined || last_name !== undefined) {
    const fn = first_name ?? body.first_name;
    const ln = last_name ?? body.last_name;
    updates.full_name = [fn, ln].filter(Boolean).join(" ");
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Colonnes systeme : client de confiance, uniquement si quelque chose change.
  if (Object.keys(systemUpdates).length > 0) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update(systemUpdates)
      .eq("id", user.id);

    if (error) {
      // Les champs utilisateur ont pu etre enregistres juste avant : erreur
      // explicite plutot qu'un succes partiel silencieux.
      return NextResponse.json(
        { error: `Echec de la mise a jour du statut du compte : ${error.message}` },
        { status: 500 }
      );
    }

    // Notifier les admins qu'une description recruteur attend validation.
    // Best-effort (pattern signup) : sans token push, rien ne part et rien ne
    // casse — le badge de comptage sur /admin reste le filet de securite.
    if (pendingReview) {
      const { data: admins } = await admin.from("profiles").select("id").eq("is_admin", true);
      for (const a of admins ?? []) {
        sendPushToUser(a.id, {
          title: "Description recruteur à valider",
          body: `${me?.bio ? "Modification" : "Nouvelle description"} en attente de validation.`,
          url: "/admin",
        }).catch(() => {});
      }
    }
  }

  // Update roles if provided
  if (roles && Array.isArray(roles)) {
    const { error: deleteError } = await supabase
      .from("profile_roles")
      .delete()
      .eq("profile_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (roles.length > 0) {
      const { error: insertError } = await supabase.from("profile_roles").insert(
        roles.map((role_name: string) => ({ profile_id: user.id, role_name }))
      );

      if (insertError) {
        // Le delete a deja vide les roles : l'utilisateur doit le savoir
        // pour pouvoir re-soumettre.
        return NextResponse.json(
          { error: "Vos roles ont ete supprimes mais leur re-enregistrement a echoue. Merci de re-enregistrer vos roles." },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ success: true, pendingReview });
}
