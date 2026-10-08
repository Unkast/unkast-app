import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getActiveUser } from "@/lib/auth-guard";
import { DISPLAY_NAME_COLUMNS, withDisplayName } from "@/lib/profile";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
type ProfileLite = { id: string; full_name: string; slug: string; avatar_url: string | null };

// Codes renvoyes par request_project_manager / decide_project_manager.
const ERRORS: Record<string, [number, string]> = {
  not_found: [404, "Film ou demande introuvable."],
  forbidden: [403, "Action non autorisée sur ce film."],
  not_credited: [403, "Il faut être crédité sur le film."],
  already_manager: [409, "Cette personne est déjà co-gestionnaire du film."],
  already_pending: [409, "Une demande est déjà en attente pour cette personne."],
  already_decided: [409, "Cette demande a déjà été traitée."],
};

// Reponse d'erreur d'une fonction metier : erreur RPC, ou { ok: false, code }.
function rpcFailure(scope: string, error: { code?: string } | null, result: { code?: string } | null) {
  if (error || !result) {
    // 22P02 : identifiant qui n'est pas un uuid.
    if (error?.code === "22P02") {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    }
    console.error(`[projects/managers] ${scope}:`, error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  const [status, message] = ERRORS[result.code ?? ""] ?? [500, "Erreur serveur."];
  return NextResponse.json({ code: result.code, error: message }, { status });
}

async function projectTitle(admin: ReturnType<typeof createAdminClient>, projectId: string) {
  const { data } = await admin.from("projects").select("title").eq("id", projectId).maybeSingle();
  return data?.title ?? "ton film";
}

// GET: gestionnaires, demandes en attente et personnes invitables (gestionnaires du film)
export async function GET(_request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }
  const { id } = await params;

  // Client utilisateur : les policies font foi (co-gestionnaires lisibles par les
  // gestionnaires, demandes lisibles par le Responsable et la personne concernee).
  const [{ data: project }, { data: managerRows }] = await Promise.all([
    supabase.from("projects").select("id, profile_id").eq("id", id).maybeSingle(),
    supabase
      .from("project_managers")
      .select("profile_id, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!project) {
    return NextResponse.json({ error: "Film introuvable." }, { status: 404 });
  }
  const managerIds = new Set((managerRows ?? []).map((m) => m.profile_id as string));
  const myRole = project.profile_id === user.id ? "owner" : managerIds.has(user.id) ? "manager" : null;
  if (!myRole) {
    return NextResponse.json({ error: "Réservé aux gestionnaires du film." }, { status: 403 });
  }

  const [{ data: requestRows }, { data: creditRows }] = await Promise.all([
    supabase
      .from("project_manager_requests")
      .select("id, kind, profile_id, created_by, created_at")
      .eq("project_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("project_credits").select("profile_id").eq("project_id", id).not("profile_id", "is", null),
  ]);

  const candidateIds = [...new Set((creditRows ?? []).map((c) => c.profile_id as string))].filter(
    (pid) => pid !== project.profile_id && !managerIds.has(pid)
  );
  const profileIds = [
    ...new Set([
      ...(project.profile_id ? [project.profile_id as string] : []),
      ...managerIds,
      ...(requestRows ?? []).map((r) => r.profile_id as string),
      ...candidateIds,
    ]),
  ];
  const { data: profileRows } = profileIds.length
    ? await supabase.from("profiles").select(`id, ${DISPLAY_NAME_COLUMNS}, slug, avatar_url`).in("id", profileIds)
    : { data: [] };
  // full_name = nom d'affichage : les colonnes de nom brutes ne sortent pas d'ici.
  const profiles = new Map((profileRows ?? []).map((p) => [p.id as string, withDisplayName(p) as ProfileLite]));
  const owner = project.profile_id ? profiles.get(project.profile_id) : undefined;

  return NextResponse.json({
    my_role: myRole,
    owner: owner
      ? { id: owner.id, full_name: owner.full_name, slug: owner.slug, avatar_url: owner.avatar_url }
      : null,
    managers: (managerRows ?? []).map((m) => {
      const p = profiles.get(m.profile_id);
      return {
        profile_id: m.profile_id,
        full_name: p?.full_name ?? null,
        slug: p?.slug ?? null,
        avatar_url: p?.avatar_url ?? null,
        created_at: m.created_at,
      };
    }),
    requests: (requestRows ?? []).map((r) => {
      const p = profiles.get(r.profile_id);
      return {
        id: r.id,
        kind: r.kind,
        profile_id: r.profile_id,
        full_name: p?.full_name ?? null,
        slug: p?.slug ?? null,
        created_at: r.created_at,
        // Annulable par son auteur (DELETE ?request_id=).
        can_cancel: r.created_by === user.id,
      };
    }),
    // Profil non lisible (non approuve) : pas invitable.
    candidates: candidateIds.flatMap((pid) => {
      const p = profiles.get(pid);
      return p ? [{ profile_id: pid, full_name: p.full_name, slug: p.slug }] : [];
    }),
  });
}

// POST: demander a co-gerer (sans profile_id) ou inviter une personne creditee (Responsable)
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const { id } = await params;
  // Corps facultatif : absent = demande pour soi-meme.
  const body = (await readJsonBody(request)) ?? {};
  if (body.profile_id != null && typeof body.profile_id !== "string") {
    return invalidBodyResponse();
  }
  const target: string = body.profile_id || user.id;

  const admin = createAdminClient();
  const { data: result, error } = await admin.rpc("request_project_manager", {
    p_actor: user.id,
    p_project: id,
    p_target: target,
  });
  if (error || !result?.ok) return rpcFailure("request_project_manager", error, result);

  // Notification best-effort a l'autre partie : la personne invitee, ou le Responsable.
  const recipient: string | null = result.kind === "invite" ? target : result.owner_id;
  if (recipient) {
    const title = await projectTitle(admin, id);
    const name = guard.profile.display_name ?? "Quelqu'un";
    sendPushToUser(
      recipient,
      result.kind === "invite"
        ? { title: "Invitation à co-gérer un film", body: `${name} t'invite à co-gérer "${title}"`, url: "/moi" }
        : { title: "Demande de co-gestion", body: `${name} demande à co-gérer "${title}"`, url: "/moi" }
    ).catch(() => {});
  }

  return NextResponse.json(
    { success: true, request_id: result.request_id, kind: result.kind },
    { status: 201 }
  );
}

// PATCH: accepter ou refuser (invitation : la personne invitee ; demande : le Responsable)
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const { id } = await params;
  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { request_id, accept } = body;
  if (!request_id || typeof request_id !== "string" || typeof accept !== "boolean") {
    return NextResponse.json({ error: "request_id et accept requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  // La demande doit porter sur le film de l'URL.
  const { data: pending } = await admin
    .from("project_manager_requests")
    .select("id")
    .eq("id", request_id)
    .eq("project_id", id)
    .maybeSingle();
  if (!pending) {
    return NextResponse.json({ code: "not_found", error: ERRORS.not_found[1] }, { status: 404 });
  }

  const { data: result, error } = await admin.rpc("decide_project_manager", {
    p_actor: user.id,
    p_request: request_id,
    p_accept: accept,
  });
  if (error || !result?.ok) return rpcFailure("decide_project_manager", error, result);

  // Notification best-effort a l'autre partie : le Responsable (invitation), ou le demandeur.
  const recipient: string | null = result.kind === "invite" ? result.owner_id : result.profile_id;
  if (recipient) {
    const title = await projectTitle(admin, id);
    const name = guard.profile.display_name ?? "Quelqu'un";
    const payload =
      result.kind === "invite"
        ? accept
          ? { title: "Invitation acceptée", body: `${name} co-gère maintenant "${title}"` }
          : { title: "Invitation déclinée", body: `${name} a décliné la co-gestion de "${title}"` }
        : accept
          ? { title: "Demande acceptée", body: `Tu co-gères maintenant "${title}"` }
          : { title: "Demande refusée", body: `Ta demande de co-gestion de "${title}" a été refusée` };
    sendPushToUser(recipient, { ...payload, url: "/moi" }).catch(() => {});
  }

  return NextResponse.json({ success: true, code: result.code });
}

// DELETE: retirer un co-gestionnaire (Responsable), ou quitter la co-gestion (soi-meme)
export async function DELETE(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;

  // ?request_id= : annuler une invitation ou une demande en attente. La policy
  // n'autorise que son auteur, et seulement tant qu'elle est en attente.
  const requestId = request.nextUrl.searchParams.get("request_id");
  if (requestId) {
    const { data: cancelled, error } = await supabase
      .from("project_manager_requests")
      .delete()
      .eq("id", requestId)
      .eq("project_id", id)
      .select("id");
    if (error) {
      if (error.code === "22P02") {
        return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
      }
      console.error("[projects/managers] annulation:", error);
      return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
    if (!cancelled || cancelled.length === 0) {
      return NextResponse.json(
        { error: "Demande introuvable, déjà traitée, ou que tu n'as pas envoyée." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  }

  const profileId = request.nextUrl.searchParams.get("profile_id");
  if (!profileId) {
    return NextResponse.json({ error: "profile_id ou request_id requis." }, { status: 400 });
  }

  // Client utilisateur : la policy n'autorise que le Responsable ou soi-meme.
  const { data: removed, error } = await supabase
    .from("project_managers")
    .delete()
    .eq("project_id", id)
    .eq("profile_id", profileId)
    .select("profile_id");

  if (error) {
    if (error.code === "22P02") {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    }
    console.error("[projects/managers] retrait:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  if (!removed || removed.length === 0) {
    return NextResponse.json(
      { error: "Co-gestionnaire introuvable ou action non autorisée." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
