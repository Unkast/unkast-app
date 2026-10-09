import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DISPLAY_NAME_COLUMNS, displayNameOf } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { markProjectEdited } from "@/lib/project-edit";

// GET: fetch credit data for dashboard
// Returns:
// - received: credit requests received on the projects the user manages
// - my_credits: projects where user is credited (for talents)
// - my_requests: credit requests sent by user (for talents)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  // 1. Demandes recues sur les films geres (Responsable ou co-gestionnaire).
  // La RLS ne rend que les demandes des films geres et les siennes : on ecarte
  // les siennes.
  const { data: reqs } = await supabase
    .from("credit_requests")
    .select("*")
    .neq("requester_id", user.id)
    .order("created_at", { ascending: false });

  // Enrich with requester name
  const received = await Promise.all(
    (reqs ?? []).map(async (req) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select(DISPLAY_NAME_COLUMNS)
        .eq("id", req.requester_id)
        .single();
      return {
        ...req,
        requester_name: displayNameOf(profile),
      };
    })
  );

  // 2. My credits (projects where I'm in project_credits)
  const { data: rawCredits } = await supabase
    .from("project_credits")
    .select("*")
    .eq("profile_id", user.id);

  const myCredits = await Promise.all(
    (rawCredits ?? []).map(async (credit) => {
      const { data: project } = await supabase
        .from("projects")
        .select("title, slug")
        .eq("id", credit.project_id)
        .single();
      return {
        ...credit,
        project_title: project?.title || null,
        project_slug: project?.slug || null,
      };
    })
  );

  // 3. My credit requests sent
  const { data: rawRequests } = await supabase
    .from("credit_requests")
    .select("*")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });

  const myRequests = await Promise.all(
    (rawRequests ?? []).map(async (req) => {
      const { data: project } = await supabase
        .from("projects")
        .select("title, slug")
        .eq("id", req.project_id)
        .single();
      return {
        ...req,
        project_title: project?.title || null,
        project_slug: project?.slug || null,
      };
    })
  );

  return NextResponse.json({
    received,
    my_credits: myCredits,
    my_requests: myRequests,
  });
}

// DELETE ?id=<credit> : la personne retire elle-meme un credit a son nom. Personne
// d'autre ne peut le faire par cette route : la suppression est limitee aux lignes
// dont profile_id est le compte de la session. Service role, car aucun client n'a
// de droit d'ecriture sur les credits d'un film qu'il ne gere pas.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Crédit invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: deleted, error } = await admin
    .from("project_credits")
    .delete()
    .eq("id", id)
    .eq("profile_id", guard.user.id)
    .select("project_id");

  if (error) {
    console.error("[dashboard/credits] retrait du credit impossible :", error);
    return NextResponse.json({ error: "Retrait impossible, réessaie." }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Crédit introuvable." }, { status: 404 });
  }

  await markProjectEdited(admin, deleted[0].project_id, guard.user.id);
  return NextResponse.json({ success: true });
}
