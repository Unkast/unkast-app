import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, full_name, roles, location, bio, avatar_url, project } = body;

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: "Email, mot de passe et nom requis." }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Erreur lors de la creation du compte." },
      { status: 400 }
    );
  }

  const userId = authData.user.id;
  const profileSlug = slugify(full_name) + "-" + userId.slice(0, 6);

  // 2. Create profile
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    full_name,
    slug: profileSlug,
    bio: bio || null,
    avatar_url: avatar_url || null,
    location: location || null,
    is_available: false,
    status: "pending",
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

  // 4. Create first project if provided
  if (project && project.title && project.video_url && project.category) {
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
      })
      .select("id")
      .single();

    if (!projectError && projectData) {
      // Add credits
      const credits = project.credits as
        | { name: string; role: string }[]
        | undefined;
      if (credits && credits.length > 0) {
        const creditInserts = credits.map(
          (c: { name: string; role: string }) => ({
            project_id: projectData.id,
            ghost_name: c.name,
            role_on_project: c.role,
          })
        );
        await supabase.from("project_credits").insert(creditInserts);
      }

      // Also add the owner as a credit
      if (project.owner_role) {
        await supabase.from("project_credits").insert({
          project_id: projectData.id,
          profile_id: userId,
          role_on_project: project.owner_role,
        });
      }
    }
  }

  return NextResponse.json({ success: true, slug: profileSlug });
}
