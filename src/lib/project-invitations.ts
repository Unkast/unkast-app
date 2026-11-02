import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";
import { mergeRoles, parseCreditRoles } from "@/lib/credits";
import { sendPushToUser } from "@/lib/push";
import { sendMemberCreditEmail } from "@/lib/email";

// Credits et invitations d'un membre deja inscrit, partages par api/invitations
// (credit par email) et api/invitations/project (invitation depuis un profil).
// Toutes les ecritures sont en service role : l'appelant a deja verifie qu'il gere
// le film.

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Droits de l'appelant sur un film : gestionnaire (Responsable ou co-gestionnaire)
 * et Responsable. `project` est null si le film n'existe pas ou n'est pas gere par
 * l'appelant. `supabase` : client utilisateur (is_project_manager lit auth.uid()).
 */
export async function projectAccess(
  supabase: SupabaseClient,
  admin: Admin,
  projectId: string,
  userId: string
): Promise<{ project: { id: string; title: string; profile_id: string } | null; isOwner: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return { project: null, isOwner: false };
  const { data: isManager } = await supabase.rpc("is_project_manager", { p_project_id: projectId });
  if (!isManager) return { project: null, isOwner: false };
  const { data: project } = await admin.from("projects").select("id, title, profile_id").eq("id", projectId).maybeSingle();
  return { project: project ?? null, isOwner: project?.profile_id === userId };
}

// Reinvitation apres un refus : pas avant 30 jours (decision du 30/10/2026).
const REINVITE_DELAY_MS = 30 * 24 * 3600 * 1000;

/**
 * Ajoute un ou des roles a une personne sur un film : UNE ligne par personne
 * (20261102_credits_one_row_per_person.sql). Si elle est deja creditee, les roles
 * rejoignent sa ligne (« Monteur / Etalonneur »), sans doublon. Sinon, nouvelle
 * ligne. Un role hors liste est refuse (false), jamais ecrit.
 */
export async function addCreditRole(admin: Admin, projectId: string, profileId: string, role: string): Promise<boolean> {
  const wanted = parseCreditRoles(role);
  if (!wanted) return false;

  // Deux passes : si un appel simultane cree la ligne entre la lecture et l'insertion
  // (23505, une seule ligne par personne), la seconde passe fusionne dans cette ligne.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: existing, error } = await admin
      .from("project_credits")
      .select("id, role_on_project")
      .eq("project_id", projectId)
      .eq("profile_id", profileId)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[project-invitations] lecture du credit :", error);
      return false;
    }

    if (existing) {
      const merged = mergeRoles(existing.role_on_project, wanted);
      if (!merged) return true; // roles deja presents
      const { error: updateError } = await admin.from("project_credits").update({ role_on_project: merged }).eq("id", existing.id);
      if (updateError) console.error("[project-invitations] fusion du role :", updateError);
      return !updateError;
    }

    const { error: insertError } = await admin.from("project_credits").insert({ project_id: projectId, profile_id: profileId, role_on_project: wanted });
    if (!insertError) return true;
    if (insertError.code !== "23505") {
      console.error("[project-invitations] creation du credit :", insertError);
      return false;
    }
  }
  return false;
}

export type InviteMemberResult = "sent" | "already_credited" | "pending" | "recently_refused" | "error";

/**
 * Invite un membre inscrit sur un film : invitation en attente (Accepter / Refuser
 * dans /moi), notification sur son telephone et email. Personne n'est credite sans
 * son accord : le credit n'est cree qu'a l'acceptation.
 */
export async function inviteMember(
  admin: Admin,
  p: {
    projectId: string;
    projectTitle: string;
    invitedId: string;
    inviterId: string;
    inviterName: string;
    role: string;
    message?: string | null;
  }
): Promise<InviteMemberResult> {
  // Deja credite avec ce role : rien a demander.
  const { data: credit } = await admin
    .from("project_credits")
    .select("role_on_project")
    .eq("project_id", p.projectId)
    .eq("profile_id", p.invitedId)
    .limit(1)
    .maybeSingle();
  if (credit && mergeRoles(credit.role_on_project, p.role) === null) return "already_credited";

  // Dernier refus de moins de 30 jours. Les refus anterieurs a la migration du
  // 30/10/2026 n'ont pas de responded_at : on prend la date d'envoi.
  const { data: refused } = await admin
    .from("project_invitations")
    .select("responded_at, created_at")
    .eq("project_id", p.projectId)
    .eq("invited_profile_id", p.invitedId)
    .eq("status", "refused")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const refusedAt = refused ? new Date(refused.responded_at ?? refused.created_at ?? 0).getTime() : 0;
  if (refused && Date.now() - refusedAt < REINVITE_DELAY_MS) return "recently_refused";

  const { error } = await admin.from("project_invitations").insert({
    project_id: p.projectId,
    invited_profile_id: p.invitedId,
    inviter_id: p.inviterId,
    role: p.role,
    message: p.message || null,
  });
  if (error) {
    // 23505 : une invitation est deja en attente (une seule par personne et par film).
    if (error.code === "23505") return "pending";
    console.error("[project-invitations] invitation :", error);
    return "error";
  }

  sendPushToUser(p.invitedId, {
    title: "Nouvelle invitation",
    body: `${p.inviterName} t'invite à rejoindre "${p.projectTitle}"`,
    url: "/moi",
  }).catch(() => {});

  const { data: invited } = await admin.auth.admin.getUserById(p.invitedId);
  if (invited?.user?.email) {
    await sendMemberCreditEmail({
      to: invited.user.email,
      inviterName: p.inviterName,
      role: p.role,
      projectTitle: p.projectTitle,
    });
  }

  return "sent";
}
