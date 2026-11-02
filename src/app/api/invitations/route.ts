import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit, isValidEmail } from "@/lib/rate-limit";
import { sendInvitationEmail } from "@/lib/email";
import { readJsonBody, invalidBodyResponse, isText } from "@/lib/api";
import { mergeRoles, parseCreditRoles } from "@/lib/credits";
import { addCreditRole } from "@/lib/project-invitations";
import { DISPLAY_NAME_COLUMNS, displayNameOf, type DisplayNameRow } from "@/lib/profile";

// POST: crediter quelqu'un PAR EMAIL sur un film (onglet Créditer de « Mes films »).
//
// Trois cas, selon le compte qui porte l'email (decisions des 30/10/2026) :
//  - l'email de l'appelant lui-meme : le role rejoint son credit, sans email
//    (reponse { self: true }) ;
//  - un autre membre : RIEN n'est envoye. La reponse { match } donne son nom public
//    et sa photo ; l'ecran propose « Créditer ce membre », qui passe par
//    POST /api/invitations/project (invitation Accepter / Refuser). Choix assume de
//    Maxime : un gestionnaire apprend qu'un email a un compte. La limite de 5 par
//    jour ci-dessous compte aussi ces recherches, ce qui borne l'enumeration ;
//  - un email inconnu : credit sans compte (ghost credit) et invitation a s'inscrire.
// Un compte qu'on ne peut pas crediter (admin, suspendu, sans profil) recoit la
// reponse d'un envoi, sans rien envoyer.
//
// Garde-fous :
//  - seulement sur un film géré par l'inviteur (Responsable ou co-gestionnaire) ;
//  - double rate-limit : 5/jour par inviteur + 200/jour global (anti-spam
//    individuel ET anti-attaque coordonnée) ;
//  - le nom est obligatoire : il est affiche dans l'equipe tant que la personne n'a
//    pas de compte, jamais l'email ;
//  - envoi via Resend uniquement (lib/email) ; en dev sans clé, email sauté.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, profile, error: guardError, status } = await getActiveUser(supabase);
  if (!user) return NextResponse.json({ error: guardError }, { status });

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { project_id, email, role, name } = body;

  if (!project_id || !email || !role || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nom, email et rôle requis." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }
  if (!isText(project_id, 64) || !isText(name.trim(), 120)) {
    return NextResponse.json({ error: "Nom trop long." }, { status: 400 });
  }
  // Des metiers de la liste (un texte « A / B » ou une liste), jamais du texte libre.
  const cleanRole = parseCreditRoles(role);
  if (!cleanRole) return NextResponse.json({ error: "Choisis des métiers dans la liste (6 au plus)." }, { status: 400 });
  const cleanName = name.trim();

  const admin = createAdminClient();

  // 1) Le film doit être géré par l'inviteur (Responsable ou co-gestionnaire).
  const { data: isManager } = await supabase.rpc("is_project_manager", { p_project_id: project_id });
  const { data: project } = isManager
    ? await admin.from("projects").select("id, title").eq("id", project_id).single()
    : { data: null };
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable ou non autorisé." }, { status: 403 });
  }

  // 2) Double plafond journalier (réutilise rate_limits + RPC, fail-open). Compte pour
  //    les trois cas : sinon la limite revelerait quels emails ont un compte.
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

  // 3) Compte qui porte cet email (fonction reservee au service role).
  const { data: accountId, error: lookupError } = await admin.rpc("user_id_by_email", { p_email: email });
  if (lookupError) {
    console.error("[invitations] recherche du compte :", lookupError);
    return NextResponse.json({ error: "Erreur lors de l'invitation." }, { status: 500 });
  }
  const inviterName = profile.display_name || "Un membre d'Unkast";

  // 3a) Son propre email : le role rejoint son credit.
  if (accountId === user.id) {
    if (!(await addCreditRole(admin, project.id, user.id, cleanRole))) {
      return NextResponse.json({ error: "Erreur lors de l'invitation." }, { status: 500 });
    }
    return NextResponse.json({ success: true, self: true }, { status: 201 });
  }

  // 3b) Un autre membre : aucun email d'inscription. L'ecran propose de le crediter.
  if (accountId) {
    const { data: member } = await admin
      .from("profiles")
      .select(`id, ${DISPLAY_NAME_COLUMNS}, avatar_url, account_type, is_suspended`)
      .eq("id", accountId)
      .maybeSingle();
    if (!member || member.account_type === "admin" || member.is_suspended) {
      return NextResponse.json({ success: true }, { status: 201 });
    }
    return NextResponse.json({
      success: true,
      match: { id: member.id, name: displayNameOf(member as DisplayNameRow), avatar_url: member.avatar_url },
    });
  }

  // 3c) Email inconnu : credit sans compte, rattache a l'inscription. Une ligne par
  //     personne : si ce nom a deja un credit sans compte sur ce film, le role le rejoint
  //     (apres l'invitation, pour ne rien changer si elle echoue).
  const { data: ghosts } = await admin
    .from("project_credits")
    .select("id, ghost_name, role_on_project")
    .eq("project_id", project_id)
    .is("profile_id", null);
  const sameGhost = (ghosts ?? []).find((g) => g.ghost_name?.trim().toLowerCase() === cleanName.toLowerCase());
  let credit: { id: string } | null = sameGhost ? { id: sameGhost.id } : null;
  if (!credit) {
    const { data: created, error: creditError } = await admin
      .from("project_credits")
      .insert({
        project_id,
        ghost_name: cleanName,
        role_on_project: cleanRole,
      })
      .select("id")
      .single();
    if (creditError || !created) {
      return NextResponse.json({ error: "Erreur lors de la création du crédit." }, { status: 500 });
    }
    credit = created;
  }

  // Invitation (token + expires_at posés par défaut DB).
  const { data: invitation, error: invError } = await admin
    .from("invitations")
    .insert({
      project_id,
      email,
      role: cleanRole,
      inviter_id: user.id,
      credit_id: credit.id,
    })
    .select("token")
    .single();

  if (invError || !invitation) {
    // Rollback logique : on retire le ghost credit qu'on vient de créer (jamais un
    // credit qui existait deja).
    if (!sameGhost) await admin.from("project_credits").delete().eq("id", credit.id);
    // 23505 : cet email est deja invite sur ce film. Meme reponse qu'un envoi, comme
    // pour un membre deja invite.
    if (invError?.code === "23505") return NextResponse.json({ success: true }, { status: 201 });
    return NextResponse.json({ error: "Erreur lors de l'invitation." }, { status: 500 });
  }

  if (sameGhost) {
    const merged = mergeRoles(sameGhost.role_on_project, cleanRole);
    if (merged) await admin.from("project_credits").update({ role_on_project: merged }).eq("id", sameGhost.id);
  }

  // Envoi via Resend (sauté proprement en dev sans clé). Le resultat n'est pas
  // renvoye : il distinguerait ce cas des deux autres.
  await sendInvitationEmail({
    to: email,
    inviterName,
    role: cleanRole,
    projectTitle: project.title,
    token: String(invitation.token),
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
