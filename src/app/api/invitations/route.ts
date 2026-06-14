import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit, isValidEmail } from "@/lib/rate-limit";
import { sendInvitationEmail } from "@/lib/email";

// POST: inviter PAR EMAIL un collaborateur absent d'Unkast (chantier 10, cas b).
//
// Garde-fous :
//  - creator UNIQUEMENT, et seulement sur un projet qu'il possède ;
//  - invitation TOUJOURS liée à un crédit réel : on crée le ghost credit dans le
//    même appel (pas de formulaire d'envoi d'email ouvert) ;
//  - double rate-limit : 5/jour par inviteur + 200/jour global (anti-spam
//    individuel ET anti-attaque coordonnée) ;
//  - une seule invitation par (email, projet) : unicité en base -> 409 propre ;
//  - envoi via Resend uniquement (lib/email) ; en dev sans clé, email sauté.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, profile, error: guardError, status } = await getActiveUser(supabase);
  if (!user) return NextResponse.json({ error: guardError }, { status });

  if (profile.account_type !== "creator") {
    return NextResponse.json({ error: "Seuls les créateurs peuvent inviter." }, { status: 403 });
  }

  const body = await request.json();
  const { project_id, email, role, name } = body;

  if (!project_id || !email || !role) {
    return NextResponse.json({ error: "project_id, email et rôle requis." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1) Le projet doit appartenir à l'inviteur (invitation liée à SON film).
  const { data: project } = await admin
    .from("projects")
    .select("id, title, profile_id")
    .eq("id", project_id)
    .eq("profile_id", user.id)
    .single();
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable ou non autorisé." }, { status: 403 });
  }

  // 2) Double plafond journalier (réutilise rate_limits + RPC, fail-open).
  if (!(await checkRateLimit(`invite:${user.id}`, 5, 86400))) {
    return NextResponse.json(
      { error: "Limite de 5 invitations par jour atteinte. Réessaie demain." },
      { status: 429 }
    );
  }
  if (!(await checkRateLimit("invite:global", 200, 86400))) {
    return NextResponse.json(
      { error: "Trop d'invitations envoyées sur Unkast aujourd'hui. Réessaie plus tard." },
      { status: 429 }
    );
  }

  // 3) Créer le ghost credit (crédit réel, sans compte rattaché pour l'instant).
  const cleanName = typeof name === "string" && name.trim() ? name.trim() : email;
  const { data: credit, error: creditError } = await admin
    .from("project_credits")
    .insert({
      project_id,
      ghost_name: cleanName,
      role_on_project: role,
    })
    .select("id")
    .single();
  if (creditError || !credit) {
    return NextResponse.json({ error: "Erreur lors de la création du crédit." }, { status: 500 });
  }

  // 4) Créer l'invitation (token + expires_at posés par défaut DB).
  const { data: invitation, error: invError } = await admin
    .from("invitations")
    .insert({
      project_id,
      email,
      role,
      inviter_id: user.id,
      credit_id: credit.id,
    })
    .select("token")
    .single();

  if (invError || !invitation) {
    // Rollback logique : on retire le ghost credit qu'on vient de créer.
    await admin.from("project_credits").delete().eq("id", credit.id);
    if (invError?.code === "23505") {
      return NextResponse.json(
        { error: "Cette personne a déjà été invitée sur ce film." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Erreur lors de l'invitation." }, { status: 500 });
  }

  // 5) Envoi via Resend (sauté proprement en dev sans clé).
  const result = await sendInvitationEmail({
    to: email,
    inviterName: profile.full_name || "Un membre d'Unkast",
    role,
    projectTitle: project.title,
    token: String(invitation.token),
  });

  return NextResponse.json({ success: true, email_sent: result.sent }, { status: 201 });
}
