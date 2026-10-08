import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { isUuid } from "@/lib/messaging";
import { CAREER_KINDS, MAX_CAREER_ENTRIES, CONTACT_REFUSED_MESSAGE } from "@/lib/constants";
import { detectContactIn } from "@/lib/contact-detector";
import { flagContactInfo } from "@/lib/contact-flag";

// Parcours du profil : entrees declaratives, texte uniquement (table
// career_entries, migration 20261008_film_management.sql). Client utilisateur
// partout : la RLS fait foi (lecture publique, ecriture par le proprietaire).

type Fields = { title?: string; role?: string; year?: number; kind?: string; production?: string | null };

function contactRefused() {
  return NextResponse.json({ code: "contact_refused", error: CONTACT_REFUSED_MESSAGE }, { status: 400 });
}

// Valide et nettoie les champs. `partial` (PATCH) : seuls les champs fournis
// sont controles. Renvoie les champs a ecrire, ou le message d'erreur.
function parseFields(body: Record<string, unknown>, partial: boolean): Fields | string {
  const fields: Fields = {};
  const given = (key: string) => !partial || body[key] !== undefined;

  if (given("title")) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 1 || title.length > 120) return "Titre requis (120 caractères maximum).";
    fields.title = title;
  }
  if (given("role")) {
    const role = typeof body.role === "string" ? body.role.trim() : "";
    if (role.length < 1 || role.length > 80) return "Rôle requis (80 caractères maximum).";
    fields.role = role;
  }
  if (given("year")) {
    const year = typeof body.year === "string" ? Number(body.year.trim() || NaN) : body.year;
    if (typeof year !== "number" || !Number.isInteger(year) || year < 1900 || year > 2100) {
      return "Année invalide (entre 1900 et 2100).";
    }
    fields.year = year;
  }
  if (given("kind")) {
    if (!CAREER_KINDS.some((k) => k.value === body.kind)) return "Type invalide.";
    fields.kind = body.kind as string;
  }
  if (given("production")) {
    if (body.production != null && typeof body.production !== "string") return "Production invalide.";
    const production = typeof body.production === "string" ? body.production.trim() : "";
    if (production.length > 120) return "Production : 120 caractères maximum.";
    fields.production = production || null;
  }
  return fields;
}

// Erreurs de base traduites : plafond (trigger) et CHECK (dernier rempart du
// texte seul, ou longueur / annee / type si la validation ci-dessus derivait).
function dbError(error: { code?: string; message: string }) {
  if (error.message.includes("career_limit_reached")) {
    return NextResponse.json(
      { code: "career_limit_reached", error: `Maximum ${MAX_CAREER_ENTRIES} entrées dans le Parcours.` },
      { status: 400 }
    );
  }
  // CHECK de la base (lien, @, suffixe de domaine) passe par le detecteur : un
  // titre comme « Dot.com ». Message distinct, ce ne sont pas des coordonnees.
  if (error.code === "23514") {
    return NextResponse.json(
      { code: "link_refused", error: "Ce texte ressemble à un lien, reformule-le." },
      { status: 400 }
    );
  }
  return NextResponse.json({ error: error.message }, { status: 500 });
}

// Cas douteux : l'entree est enregistree, puis signalee a l'admin (best-effort).
async function flagIfDoubtful(id: string, verdict: ReturnType<typeof detectContactIn>, fields: Fields) {
  if (verdict.level !== "doubtful") return;
  const text = [fields.title, fields.role, fields.production].filter(Boolean).join(" | ");
  await flagContactInfo(createAdminClient(), "career_entry", id, verdict.reason, text);
}

// GET: entrees de l'utilisateur, annee decroissante puis creation decroissante
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifie." }, { status: 401 });

  const { data, error } = await supabase
    .from("career_entries")
    .select("*")
    .eq("profile_id", user.id)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

// POST: { title, role, year, kind, production? }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();

  const fields = parseFields(body, false);
  if (typeof fields === "string") return NextResponse.json({ error: fields }, { status: 400 });

  const verdict = detectContactIn(fields.title, fields.role, fields.production);
  if (verdict.level === "obvious") return contactRefused();

  const { data: entry, error } = await supabase
    .from("career_entries")
    .insert({ profile_id: guard.user.id, ...fields })
    .select("*")
    .single();

  if (error) return dbError(error);

  await flagIfDoubtful(entry.id, verdict, fields);
  return NextResponse.json({ entry }, { status: 201 });
}

// PATCH: { id, title?, role?, year?, kind?, production? }
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  if (!isUuid(body.id)) return NextResponse.json({ error: "id invalide." }, { status: 400 });

  const fields = parseFields(body, true);
  if (typeof fields === "string") return NextResponse.json({ error: fields }, { status: 400 });
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Aucun champ à modifier." }, { status: 400 });
  }

  const verdict = detectContactIn(fields.title, fields.role, fields.production);
  if (verdict.level === "obvious") return contactRefused();

  const { data: entry, error } = await supabase
    .from("career_entries")
    .update(fields)
    .eq("id", body.id)
    .eq("profile_id", guard.user.id)
    .select("*")
    .maybeSingle();

  if (error) return dbError(error);
  if (!entry) return NextResponse.json({ error: "Entrée introuvable." }, { status: 404 });

  await flagIfDoubtful(entry.id, verdict, fields);
  return NextResponse.json({ entry });
}

// DELETE: ?id=
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!isUuid(id)) return NextResponse.json({ error: "id invalide." }, { status: 400 });

  const { data: deleted, error } = await supabase
    .from("career_entries")
    .delete()
    .eq("id", id)
    .eq("profile_id", guard.user.id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Entrée introuvable." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
