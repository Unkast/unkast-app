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
  const { full_name, first_name, last_name, stage_name, display_name_preference, bio, location, is_available, avatar_url, roles, contact_email, contact_phone, instagram_url, website_url, show_contact_email_to, show_phone_to, show_real_name_to, is_recruiting, recruiting_roles } = body;

  // Update profile fields
  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (stage_name !== undefined) updates.stage_name = stage_name;
  if (display_name_preference !== undefined) updates.display_name_preference = display_name_preference;
  if (bio !== undefined) updates.bio = bio;
  if (location !== undefined) updates.location = location;
  if (is_available !== undefined) updates.is_available = is_available;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;
  if (contact_email !== undefined) updates.contact_email = contact_email;
  if (contact_phone !== undefined) updates.contact_phone = contact_phone;
  if (instagram_url !== undefined) updates.instagram_url = instagram_url;
  if (website_url !== undefined) updates.website_url = website_url;
  if (show_contact_email_to !== undefined) updates.show_contact_email_to = show_contact_email_to;
  if (show_phone_to !== undefined) updates.show_phone_to = show_phone_to;
  if (show_real_name_to !== undefined) updates.show_real_name_to = show_real_name_to;
  if (is_recruiting !== undefined) {
    updates.is_recruiting = is_recruiting;
    updates.recruiting_roles = is_recruiting ? (recruiting_roles || []) : [];
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
