import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { DISPLAY_NAME_COLUMNS, displayNameOf, type DisplayNameRow } from "@/lib/profile";

// GET: chercher un membre a crediter (onglet « Créditer » de « Mes films »).
//
// Recherche sur le nom d'affichage SEULEMENT (display_name : nom de scene si la
// personne l'affiche, sinon prenom + nom). Jamais sur le vrai nom d'une personne
// qui affiche un nom de scene : full_name, first_name et last_name ne sont pas lus.
// Profils approuves, non suspendus, hors compte admin et hors l'appelant ; 8 au plus.
// Service role : la route ne renvoie que des champs deja publics (nom affiche,
// photo, metier).

const MAX_RESULTS = 8;
const MAX_QUERY_LENGTH = 60;

// Wildcards ILIKE echappes : un `%` ou `_` saisi est cherche tel quel.
function escapeLikeWildcards(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, (c) => `\\${c}`);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // Saisie en direct : 5 requetes par seconde et 60 par minute, par compte.
  const [burst, minute] = await Promise.all([
    checkRateLimit(`member-search-burst:${guard.user.id}`, 5, 1),
    checkRateLimit(`member-search:${guard.user.id}`, 60, 60),
  ]);
  if (!burst || !minute) {
    return NextResponse.json({ error: "Trop de recherches. Réessaie dans un instant." }, { status: 429 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Recherche trop longue." }, { status: 400 });
  }
  if (q.length < 2) return NextResponse.json({ members: [] });

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select(`id, ${DISPLAY_NAME_COLUMNS}, avatar_url, profile_roles ( role_name )`)
    .eq("status", "approved")
    .not("is_suspended", "is", true)
    .neq("account_type", "admin")
    .neq("id", guard.user.id)
    .ilike("display_name", `%${escapeLikeWildcards(q)}%`)
    .order("display_name", { ascending: true })
    .limit(MAX_RESULTS);
  if (error) {
    console.error("[members/search] recherche :", error);
    return NextResponse.json({ error: "Recherche impossible pour le moment." }, { status: 500 });
  }

  const members = (data ?? []).map((p) => ({
    id: p.id,
    name: displayNameOf(p as DisplayNameRow),
    avatar_url: p.avatar_url,
    role: (p.profile_roles as { role_name: string }[] | null)?.[0]?.role_name ?? null,
  }));
  return NextResponse.json({ members });
}
