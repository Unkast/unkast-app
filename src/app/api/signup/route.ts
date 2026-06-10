import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { MAX_PROJECTS_FREE } from "@/lib/constants";
import { checkRateLimit, getClientIp, isValidEmail } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Anti-abus : max 5 créations de compte par heure et par IP.
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`signup:${ip}`, 5, 3600))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans une heure." },
      { status: 429 }
    );
  }

  const body = await request.json();
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

  // 1. Create auth user (admin API — no email confirmation needed)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Erreur lors de la creation du compte." },
      { status: 400 }
    );
  }

  const userId = authData.user.id;
  const profileSlug = slugify(full_name) + "-" + userId.slice(0, 6);

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

    if ((count ?? 0) < MAX_PROJECTS_FREE) {
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
          status: "pending",
        })
        .select("id")
        .single();

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

  // 5. Create credit request if provided (talent/member)
  if (
    (account_type === "member" || account_type === "talent") &&
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

  return NextResponse.json({ success: true, slug: profileSlug });
}
