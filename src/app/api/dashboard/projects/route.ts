import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CATEGORY_LABELS,
  CLIENT_AUTHORIZATION_CATEGORIES,
  CONTACT_REFUSED_MESSAGE,
  DECLARED_ROLES,
  MAX_PROJECTS_FREE,
  MAX_PROJECTS_PRO,
  PROJECT_VISIBILITIES,
  RIGHTS_DECLARATION_VERSION,
} from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { detectContactIn } from "@/lib/contact-detector";
import { flagContactInfo } from "@/lib/contact-flag";
import { fetchVideoMeta } from "@/lib/oembed";

const RIGHTS_REQUIRED = {
  code: "rights_declaration_required",
  error: "Indique ton rôle sur le film et confirme que tu détiens les droits de diffusion.",
};
const CLIENT_AUTHORIZATION_REQUIRED = {
  code: "client_authorization_required",
  error: "Confirme que le client ou le label a autorisé la diffusion publique.",
};
const CONTACT_REFUSED = { code: "contact_refused", error: CONTACT_REFUSED_MESSAGE };

const planLimit = (plan: string | null | undefined) =>
  plan === "pro" ? MAX_PROJECTS_PRO : MAX_PROJECTS_FREE;
const limitMessage = (limit: number) => `Maximum ${limit} films pour ton offre actuelle.`;

const isDeclaredRole = (v: unknown) => DECLARED_ROLES.some((r) => r.value === v);
const isCategory = (v: unknown) => typeof v === "string" && Object.hasOwn(CATEGORY_LABELS, v);
const needsClientAuthorization = (category: unknown) =>
  (CLIENT_AUTHORIZATION_CATEGORIES as string[]).includes(category as string);

// p_credits de publish_project : credit automatique du role declare, owner_role
// s'il en differe, puis credits fantomes. (Meme construction dans api/signup.)
function buildCredits(userId: string, declaredRole: unknown, ownerRole: unknown, credits: unknown) {
  const auto = DECLARED_ROLES.find((r) => r.value === declaredRole)?.credit ?? null;
  const own = typeof ownerRole === "string" ? ownerRole.trim() : "";
  const out: { profile_id: string | null; ghost_name: string | null; role: string }[] = [];
  if (auto) out.push({ profile_id: userId, ghost_name: null, role: auto });
  if (own && own.toLowerCase() !== auto?.toLowerCase()) {
    out.push({ profile_id: userId, ghost_name: null, role: own });
  }
  if (Array.isArray(credits)) {
    for (const c of credits) {
      if (c?.name && c?.role) out.push({ profile_id: null, ghost_name: c.name, role: c.role });
    }
  }
  return out;
}

// GET: films dont l'utilisateur est Responsable ou co-gestionnaire, avec credits
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const [{ data: planRow }, { data: managed }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase.from("project_managers").select("project_id").eq("profile_id", user.id),
  ]);
  const managedIds = (managed ?? []).map((m) => m.project_id);

  // Filtre explicite : la lecture de projects expose aussi tous les films publics.
  let query = supabase.from("projects").select("*");
  query = managedIds.length
    ? query.or(`profile_id.eq.${user.id},id.in.(${managedIds.join(",")})`)
    : query.eq("profile_id", user.id);
  const { data: projects } = await query.order("created_at", { ascending: false });

  const list = projects ?? [];
  const ids = list.map((p) => p.id);
  const ownedIds = list.filter((p) => p.profile_id === user.id).map((p) => p.id);

  const [{ data: credits }, { data: declarations }] = await Promise.all([
    ids.length
      ? supabase.from("project_credits").select("*").in("project_id", ids)
      : Promise.resolve({ data: [] }),
    ownedIds.length
      ? supabase
          .from("project_rights_declarations")
          .select("project_id")
          .eq("profile_id", user.id)
          .in("project_id", ownedIds)
      : Promise.resolve({ data: [] }),
  ]);
  const declared = new Set((declarations ?? []).map((d) => d.project_id));

  return NextResponse.json({
    projects: list.map((p) => {
      const isOwner = p.profile_id === user.id;
      return {
        ...p,
        credits: (credits ?? []).filter((c) => c.project_id === p.id),
        my_role: isOwner ? "owner" : "manager",
        needs_rights_declaration: isOwner && !declared.has(p.id),
      };
    }),
    owned_count: ownedIds.length,
    limit: planLimit(planRow?.plan),
  });
}

// POST: publier un film (fonction publish_project, service role)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const {
    title, category, year, video_url, owner_role, credits,
    declared_role, rights_accepted, client_authorized,
  } = body;
  const description = typeof body.description === "string" ? body.description : null;

  if (!title || !category || !video_url) {
    return NextResponse.json({ error: "Titre, categorie et URL video requis." }, { status: 400 });
  }
  if (typeof title !== "string" || typeof video_url !== "string" || !isCategory(category)) {
    return NextResponse.json({ error: "Titre, catégorie ou URL vidéo invalide." }, { status: 400 });
  }
  if (rights_accepted !== true || !isDeclaredRole(declared_role)) {
    return NextResponse.json(RIGHTS_REQUIRED, { status: 400 });
  }
  if (needsClientAuthorization(category) && client_authorized !== true) {
    return NextResponse.json(CLIENT_AUTHORIZATION_REQUIRED, { status: 400 });
  }

  const verdict = detectContactIn(title, description);
  if (verdict.level === "obvious") {
    return NextResponse.json(CONTACT_REFUSED, { status: 400 });
  }

  // Plafond plan-aware, valeurs dans lib/constants. Plan lu cote serveur (garde).
  // Verification rapide ici ; publish_project la refait de facon atomique.
  const projectLimit = planLimit(guard.profile.plan);
  const { count } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id);
  if ((count ?? 0) >= projectLimit) {
    return NextResponse.json(
      { code: "limit_reached", error: limitMessage(projectLimit) },
      { status: 400 }
    );
  }

  const meta = await fetchVideoMeta(video_url);
  if (!meta.ok) {
    return NextResponse.json(
      {
        code: "video_private",
        error: "Cette vidéo est privée ou protégée par mot de passe. Rends-la publique ou non répertoriée, puis réessaie.",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: result, error } = await admin.rpc("publish_project", {
    p_profile_id: user.id,
    p_title: title,
    p_slug: slugify(title) + "-" + Date.now().toString(36),
    p_description: description,
    p_category: category,
    p_year: year || new Date().getFullYear(),
    p_video_url: video_url,
    p_declared_role: declared_role,
    p_text_version: RIGHTS_DECLARATION_VERSION,
    p_client_authorized: client_authorized === true,
    p_limit: projectLimit,
    p_source_title: meta.title,
    p_source_author: meta.author,
    p_credits: buildCredits(user.id, declared_role, owner_role, credits),
  });

  if (error || !result) {
    console.error("[dashboard/projects] publish_project:", error);
    return NextResponse.json({ error: "Erreur lors de la publication du film." }, { status: 500 });
  }

  switch (result.code) {
    case "created":
      if (verdict.level === "doubtful" && description) {
        await flagContactInfo(admin, "project", result.project_id, verdict.reason, description);
      }
      return NextResponse.json({ success: true, id: result.project_id });
    case "duplicate":
      // project null : doublon tranche par l'index unique (course), film non identifie.
      // slug et title null : film existant non visible.
      return NextResponse.json(
        {
          code: "duplicate",
          error: "Cette vidéo est déjà référencée sur Unkast.",
          project: result.project_id
            ? {
                id: result.project_id,
                slug: result.slug ?? null,
                title: result.title ?? null,
                is_visible: result.is_visible === true,
              }
            : null,
        },
        { status: 409 }
      );
    case "limit_reached":
      return NextResponse.json(
        { code: "limit_reached", error: limitMessage(projectLimit) },
        { status: 400 }
      );
    case "rights_declaration_required":
      return NextResponse.json(RIGHTS_REQUIRED, { status: 400 });
    case "client_authorization_required":
      return NextResponse.json(CLIENT_AUTHORIZATION_REQUIRED, { status: 400 });
    default:
      console.error("[dashboard/projects] publish_project, code inattendu:", result);
      return NextResponse.json({ error: "Erreur lors de la publication du film." }, { status: 500 });
  }
}

// PATCH: modifier un film (gestionnaires ; visibilite : Responsable seul)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { id, declaration } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID projet requis." }, { status: 400 });
  }

  // Uniquement les colonnes accordees par GRANT, et seulement celles fournies.
  const updates: Record<string, string | number | null> = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Le titre ne peut pas être vide." }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      return NextResponse.json({ error: "Description invalide." }, { status: 400 });
    }
    updates.description = body.description?.trim() || null;
  }
  if (body.category !== undefined) {
    if (!isCategory(body.category)) {
      return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
    }
    updates.category = body.category;
  }
  if (body.year !== undefined) {
    if (!Number.isInteger(body.year)) {
      return NextResponse.json({ error: "Année invalide." }, { status: 400 });
    }
    updates.year = body.year;
  }
  if (body.visibility !== undefined) {
    if (!PROJECT_VISIBILITIES.some((v) => v.value === body.visibility)) {
      return NextResponse.json({ error: "Visibilité invalide." }, { status: 400 });
    }
    updates.visibility = body.visibility;
  }

  const declares = declaration?.rights_accepted === true;
  if (Object.keys(updates).length === 0 && !declares) {
    return NextResponse.json({ error: "Aucune modification." }, { status: 400 });
  }

  const title = (updates.title as string | undefined) ?? null;
  const description = (updates.description as string | null | undefined) ?? null;
  const verdict = detectContactIn(title, description);
  if (verdict.level === "obvious") {
    return NextResponse.json(CONTACT_REFUSED, { status: 400 });
  }

  // Declaration de droits du Responsable, avant la modification (le trigger
  // guard_projects_columns l'exige pour toucher au contenu).
  if (declares) {
    if (!isDeclaredRole(declaration.declared_role)) {
      return NextResponse.json(RIGHTS_REQUIRED, { status: 400 });
    }
    const { data: project } = await supabase
      .from("projects")
      .select("profile_id, category")
      .eq("id", id)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Film introuvable ou non autorisé." }, { status: 404 });
    }
    const ownerOnly = NextResponse.json(
      { code: "owner_only", error: "Seul le Responsable du film peut déclarer les droits de diffusion." },
      { status: 403 }
    );
    if (project.profile_id !== user.id) return ownerOnly;
    // Categorie d'arrivee : la policy ne voit que la categorie encore en base.
    if (needsClientAuthorization(updates.category ?? project.category) && declaration.client_authorized !== true) {
      return NextResponse.json(CLIENT_AUTHORIZATION_REQUIRED, { status: 400 });
    }

    const { error: declError } = await supabase.from("project_rights_declarations").insert({
      project_id: id,
      profile_id: user.id,
      declared_role: declaration.declared_role,
      text_version: RIGHTS_DECLARATION_VERSION,
      client_authorized: declaration.client_authorized === true,
    });
    if (declError) {
      // 42501 : policy « Owner declares rights » (course avec un transfert).
      if (declError.code === "42501") return ownerOnly;
      console.error("[dashboard/projects] declaration de droits:", declError);
      return NextResponse.json({ error: "Erreur lors de l'enregistrement de la déclaration." }, { status: 500 });
    }
  }

  if (Object.keys(updates).length > 0) {
    const { data: updated, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select("id");

    if (error) {
      // Erreurs levees par le trigger guard_projects_columns.
      if (error.message?.includes("rights_declaration_required")) {
        return NextResponse.json(
          { code: "rights_declaration_required", error: "Confirme tes droits de diffusion avant de modifier ce film." },
          { status: 409 }
        );
      }
      if (error.message?.includes("owner_only")) {
        return NextResponse.json(
          { code: "owner_only", error: "Seul le Responsable du film peut changer sa visibilité." },
          { status: 403 }
        );
      }
      console.error("[dashboard/projects] modification:", error);
      return NextResponse.json({ error: "Erreur lors de la modification du film." }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Film introuvable ou non autorisé." }, { status: 404 });
    }

    if (verdict.level === "doubtful") {
      const excerpt = [title, description].filter(Boolean).join(" / ");
      await flagContactInfo(createAdminClient(), "project", id, verdict.reason, excerpt);
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE: supprimer un film (Responsable seul, garanti par la policy)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id");

  if (!projectId) {
    return NextResponse.json({ error: "ID projet requis." }, { status: 400 });
  }

  const { data: deleted, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("profile_id", user.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Film introuvable ou réservé au Responsable." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
