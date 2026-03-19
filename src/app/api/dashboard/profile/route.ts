import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: fetch current user's profile with roles
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

  const { data: roles } = await supabase
    .from("profile_roles")
    .select("*")
    .eq("profile_id", user.id);

  return NextResponse.json({ profile, roles: roles ?? [] });
}

// PATCH: update profile
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const body = await request.json();
  const { full_name, bio, location, is_available, avatar_url, roles } = body;

  // Update profile fields
  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (bio !== undefined) updates.bio = bio;
  if (location !== undefined) updates.location = location;
  if (is_available !== undefined) updates.is_available = is_available;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update roles if provided
  if (roles && Array.isArray(roles)) {
    await supabase.from("profile_roles").delete().eq("profile_id", user.id);
    if (roles.length > 0) {
      await supabase.from("profile_roles").insert(
        roles.map((role_name: string) => ({ profile_id: user.id, role_name }))
      );
    }
  }

  return NextResponse.json({ success: true });
}
