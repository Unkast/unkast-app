import { cookies } from "next/headers";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DISPLAY_NAME_COLUMNS, displayNameOf } from "@/lib/profile";
import { TERMS_VERSION } from "@/lib/legal";
import { ADMIN_ACCOUNT_TYPE, VIEW_COOKIE, VIEW_VISITOR } from "@/lib/adminSession";

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
  // Vrai si le membre n'a pas accepte la version en vigueur des CGU : AppShell
  // affiche alors l'ecran « Les CGU ont ete mises a jour ». Si la lecture echoue,
  // on ne bloque pas (false) : l'ecran reviendra a la page suivante.
  let needsTerms = false;
  // Bandeau d'AppShell : le compte admin regarde le site (vue membre ou visiteur).
  let adminView: "member" | "visitor" | null = null;
  const cookieStore = await cookies();

  if (user) {
    // is_admin est revoque en SELECT pour `authenticated` (migration
    // 20260731_profiles_column_grants.sql) : l'ajouter au select() ci-dessous
    // ferait echouer toute la requete (colonne non couverte par le grant).
    // On la lit donc via le client de confiance (service role), scope sur
    // l'utilisateur courant — meme pattern que /api/me et lib/adminGuard.ts.
    const admin = createAdminClient();
    const [{ data: profile }, { data: roles }, { count }, { data: adminRow }] = await Promise.all([
      supabase
        .from("profiles")
        .select(`${DISPLAY_NAME_COLUMNS}, slug, account_type, avatar_url`)
        .eq("id", user.id)
        .single(),
      supabase.from("profile_roles").select("role_name").eq("profile_id", user.id),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .eq("is_read", false),
      // terms_version n'a aucun droit client (migration 20261012) : meme lecture.
      admin.from("profiles").select("is_admin, terms_version").eq("id", user.id).single(),
    ]);

    if (profile) {
      initialUser = {
        full_name: displayNameOf(profile) as string,
        slug: profile.slug,
        account_type: profile.account_type || "talent",
        avatar_url: profile.avatar_url,
        role_name: roles?.[0]?.role_name,
        is_admin: adminRow?.is_admin === true,
      };
    }
    initialUnread = count ?? 0;
    // Compte admin dedie : pas d'ecran CGU (il n'utilise pas le service comme membre).
    const isAdminAccount = profile?.account_type === ADMIN_ACCOUNT_TYPE;
    needsTerms = !isAdminAccount && !!adminRow && adminRow.terms_version !== TERMS_VERSION;
    if (isAdminAccount) adminView = "member";
  }
  // « Voir le site comme : visiteur » : createClient() a deja lu le site sans session.
  if (cookieStore.get(VIEW_COOKIE)?.value === VIEW_VISITOR) adminView = "visitor";

  // Compte non resolu alors qu'un cookie de session existe (lecture en echec, jeton a
  // renouveler) : AppShell attend le navigateur au lieu d'afficher le mode visiteur.
  const sessionHint = !initialUser && adminView !== "visitor" && cookieStore.getAll().some((c) => /^sb-.+-auth-token/.test(c.name));

  return (
    <AppShell initialUser={initialUser} initialUnread={initialUnread} needsTerms={needsTerms} sessionHint={sessionHint} adminView={adminView}>
      {children}
    </AppShell>
  );
}
