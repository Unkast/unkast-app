import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { VIEW_COOKIE, VIEW_VISITOR } from "@/lib/adminSession";

// `ignoreView` : reserve a la garde admin (lib/adminGuard.ts). Partout ailleurs, la
// vue « visiteur » de l'admin (cookie unkast_view) fait lire le site SANS session :
// les cookies d'authentification sont ignores, pages et routes repondent comme a un
// visiteur non connecte. Le cookie ne peut que retirer des droits.
export async function createClient({ ignoreView = false }: { ignoreView?: boolean } = {}) {
  const cookieStore = await cookies();
  const asVisitor = !ignoreView && cookieStore.get(VIEW_COOKIE)?.value === VIEW_VISITOR;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = cookieStore.getAll();
          return asVisitor ? all.filter((c) => !/^sb-.+-auth-token/.test(c.name)) : all;
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
