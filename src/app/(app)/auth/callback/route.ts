import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if profile already exists
      const admin = createAdminClient();
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingProfile) {
        // First Google login — create profile automatically
        const fullName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split("@")[0] ||
          "Utilisateur";
        const avatarUrl = data.user.user_metadata?.avatar_url || null;
        const profileSlug = slugify(fullName) + "-" + data.user.id.slice(0, 6);

        await admin.from("profiles").insert({
          id: data.user.id,
          full_name: fullName,
          slug: profileSlug,
          bio: null,
          avatar_url: avatarUrl,
          location: null,
          is_available: false,
          status: "approved",
          account_type: "talent",
        });

        // Redirect to rejoindre step 3 to complete profile
        return NextResponse.redirect(`${origin}/rejoindre?complete=true`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to connexion with error
  return NextResponse.redirect(`${origin}/connexion?error=auth`);
}
