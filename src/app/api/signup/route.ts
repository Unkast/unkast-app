import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify, extractVideoKey } from "@/lib/utils";
import { MAX_PROJECTS_FREE } from "@/lib/constants";
import { checkRateLimit, getClientIp, isValidEmail } from "@/lib/rate-limit";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { sendPushToUser } from "@/lib/push";
import { sendConfirmationEmail } from "@/lib/email";
import { siteUrl } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  // Anti-abus : max 5 créations de compte par heure et par IP.
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`signup:${ip}`, 5, 3600))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans une heure." },
      { status: 429 }
    );
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const {
    email,
    password,
    full_name,
    roles,
    location,
    bio,
    avatar_url,
    account_type,
    project,
    credit_request,
    recruiter_company,
    recruiter_role,
    recruiter_website,
    is_looking_for,
    invitation_token,
  } = body;
  // SÉCURITÉ : recruiter_status n'est JAMAIS lu depuis le body — un client pourrait
  // s'auto-attribuer "approved". Toujours forcé à "pending" (validation manuelle admin).

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: "Email, mot de passe et nom requis." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Créer l'utilisateur NON confirmé ET récupérer le lien de confirmation,
  //    SANS qu'aucun email Supabase ne parte : on envoie nous-mêmes l'email au
  //    branding Unkast via Resend (Option A). La confirmation email doit être
  //    activée côté Supabase ("Confirm email" ON) pour bloquer le login tant que
  //    l'adresse n'est pas confirmée.
  const { data: linkData, error: authError } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${siteUrl()}/auth/confirm` },
  });

  if (authError || !linkData.user) {
    // Anti-énumération : ne JAMAIS renvoyer le message brut de Supabase Auth
    // ("already registered" révèle qu'un compte existe). Message générique
    // pour toutes les erreurs Auth, erreur réelle loguée côté serveur.
    console.error("[signup] generateLink error:", authError);
    return NextResponse.json(
      { error: "Impossible de créer le compte. Vérifie tes informations, ou connecte-toi si tu as déjà un compte." },
      { status: 400 }
    );
  }

  const userId = linkData.user.id;
  const hashedToken = linkData.properties?.hashed_token;
  const profileSlug = slugify(full_name) + "-" + userId.slice(0, 6);

  // Compensation anti-orphelin : si la creation du profil echoue ci-dessous,
  // l'utilisateur Auth resterait orphelin (email definitivement bloque). On ne
  // supprimera QUE l'utilisateur ne dans CETTE requete — jamais un compte
  // preexistant : generateLink(type signup) peut aussi renvoyer un utilisateur
  // existant non confirme (re-tentative d'inscription). Criteres cumulatifs :
  //  - aucun profil deja en base pour cet id (une inscription anterieure aboutie
  //    a toujours un profil) ;
  //  - email jamais confirme ;
  //  - compte cree il y a moins de 60 s (donc par cette requete).
  const { data: preexistingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  const createdByThisRequest =
    !preexistingProfile &&
    !linkData.user.email_confirmed_at &&
    Date.now() - new Date(linkData.user.created_at).getTime() < 60_000;

  // 2. Create profile (admin client bypasses RLS)
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    full_name,
    slug: profileSlug,
    bio: bio || null,
    avatar_url: avatar_url || null,
    location: location || null,
    is_available: false,
    status: "approved",
    account_type: account_type || "talent",
    ...(account_type === "recruiter" ? {
      recruiter_company: recruiter_company || null,
      recruiter_role: recruiter_role || null,
      recruiter_website: recruiter_website || null,
      recruiter_status: "pending",
      is_looking_for: is_looking_for || null,
    } : {}),
  });

  if (profileError) {
    console.error("[signup] profile insert error:", profileError);
    if (createdByThisRequest) {
      // Libere l'email en supprimant l'utilisateur Auth cree par cette requete.
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(userId);
      if (cleanupError) {
        console.error("[signup] compensation deleteUser echouee (utilisateur orphelin):", cleanupError);
      }
    }
    return NextResponse.json(
      { error: "Erreur lors de la creation du profil: " + profileError.message },
      { status: 500 }
    );
  }

  // 3. Insert roles
  if (roles && Array.isArray(roles) && roles.length > 0) {
    const roleInserts = roles.map((role_name: string) => ({
      profile_id: userId,
      role_name,
    }));
    await supabase.from("profile_roles").insert(roleInserts);
  }

  // 4. Create first project if provided (creator only)
  // Anti-vol d'œuvre (chantier 9) : si la vidéo est déjà référencée, on NE bloque
  // PAS l'inscription — le compte est créé, mais le film est sauté et l'UI prévient.
  let videoSkipped = false;
  if (
    account_type === "creator" &&
    project &&
    project.title &&
    project.video_url &&
    project.category
  ) {
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId);

    // Doublon ? Identifiant canonique (youtube:<id> / vimeo:<id>), pas l'URL brute.
    const video_key = extractVideoKey(project.video_url);
    let isDuplicate = false;
    if (video_key) {
      const { data: dup } = await supabase
        .from("projects")
        .select("id")
        .eq("video_key", video_key)
        .limit(1)
        .maybeSingle();
      isDuplicate = !!dup;
    }

    // Nouveau compte = toujours 'free' a l'inscription (le passage Pro se fait
    // ensuite via l'admin) -> plafond gratuit. Un seul projet cree ici de toute facon.
    if (isDuplicate) {
      videoSkipped = true;
    } else if ((count ?? 0) < MAX_PROJECTS_FREE) {
      const projectSlug = slugify(project.title) + "-" + Date.now().toString(36);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .insert({
          profile_id: userId,
          title: project.title,
          slug: projectSlug,
          description: project.description || null,
          category: project.category,
          year: project.year || new Date().getFullYear(),
          video_url: project.video_url,
          video_key,
          status: "pending",
        })
        .select("id")
        .single();

      // Filet 23505 : course gagnée par l'index unique → on saute le film, compte gardé.
      if (projectError?.code === "23505") {
        videoSkipped = true;
      }

      if (!projectError && projectData) {
        const credits = project.credits as { name: string; role: string }[] | undefined;
        if (credits && credits.length > 0) {
          const creditInserts = credits.map((c: { name: string; role: string }) => ({
            project_id: projectData.id,
            ghost_name: c.name,
            role_on_project: c.role,
          }));
          await supabase.from("project_credits").insert(creditInserts);
        }

        if (project.owner_role) {
          await supabase.from("project_credits").insert({
            project_id: projectData.id,
            profile_id: userId,
            role_on_project: project.owner_role,
          });
        }
      }
    }
  }

  // 5. Create credit request if provided (talent)
  if (
    account_type === "talent" &&
    credit_request &&
    credit_request.project_id &&
    credit_request.role
  ) {
    await supabase.from("credit_requests").insert({
      project_id: credit_request.project_id,
      requester_id: userId,
      role: credit_request.role,
      status: "pending",
    });
  }

  // 6. Rattachement d'une invitation email (chantier 10).
  // Le ghost credit devient un vrai crédit lié au nouveau compte — UNIQUEMENT si
  // l'email du compte == l'email invité (anti-détournement : le token seul ne
  // suffit pas). Jamais d'échec global de l'inscription si quoi que ce soit cloche.
  if (invitation_token) {
    try {
      const { data: inv } = await supabase
        .from("invitations")
        .select("id, email, role, credit_id, project_id, inviter_id, status, expires_at")
        .eq("token", invitation_token)
        .maybeSingle();

      const notExpired = inv?.expires_at ? new Date(inv.expires_at).getTime() >= Date.now() : true;
      const emailMatches =
        inv?.email && email && inv.email.trim().toLowerCase() === email.trim().toLowerCase();

      if (inv && inv.status === "pending" && notExpired && emailMatches) {
        // Convertir le ghost credit en crédit réel lié au profil.
        if (inv.credit_id) {
          await supabase
            .from("project_credits")
            .update({ profile_id: userId, ghost_name: null })
            .eq("id", inv.credit_id);
        }
        await supabase.from("invitations").update({ status: "accepted" }).eq("id", inv.id);

        // Notifier l'inviteur (best-effort).
        if (inv.inviter_id) {
          const { data: proj } = await supabase
            .from("projects").select("title").eq("id", inv.project_id).single();
          sendPushToUser(inv.inviter_id, {
            title: "Invitation acceptée !",
            body: `${full_name} a rejoint l'équipe de "${proj?.title ?? "ton film"}"`,
            url: "/moi",
          }).catch(() => {});
        }
      }
    } catch {
      // Rattachement best-effort : on n'interrompt jamais l'inscription.
    }
  }

  // 7. Email de confirmation au branding Unkast via Resend (lien sur notre
  // domaine -> /auth/confirm fera le verifyOtp + auto-login). En dev sans clé
  // Resend, l'email est sauté proprement (confirmation_sent=false).
  let confirmationSent = false;
  if (hashedToken) {
    const confirmUrl = `${siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=signup`;
    const res = await sendConfirmationEmail({ to: email, confirmUrl });
    confirmationSent = res.sent;
  }

  return NextResponse.json({
    success: true,
    slug: profileSlug,
    video_skipped: videoSkipped,
    needs_confirmation: true,
    confirmation_sent: confirmationSent,
  });
}
