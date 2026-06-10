import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";

// On résout l'utilisateur + son profil + le compteur de non-lus CÔTÉ SERVEUR,
// puis on les passe à AppShell en props. Évite le waterfall client au montage
// (getUser → /api/dashboard/profile → /api/messages/unread-count en cascade)
// qui retardait l'affichage du nom/avatar/badge sur toutes les pages.
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialUser = null;
  let initialUnread = 0;

  if (user) {
    const [{ data: profile }, { data: roles }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, slug, account_type, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase.from("profile_roles").select("role_name").eq("profile_id", user.id),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .eq("is_read", false),
    ]);

    if (profile) {
      initialUser = {
        full_name: profile.full_name,
        slug: profile.slug,
        account_type: profile.account_type || "member",
        avatar_url: profile.avatar_url,
        role_name: roles?.[0]?.role_name,
      };
    }
    initialUnread = count ?? 0;
  }

  return (
    <AppShell initialUser={initialUser} initialUnread={initialUnread}>
      {children}
    </AppShell>
  );
}
