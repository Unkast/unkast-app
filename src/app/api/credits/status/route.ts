import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/credits/status?project_id=...
// Returns { isCredited, hasPendingRequest, isOwner, isManager, managerRequest, claimPending }
// isOwner = Responsable ; isManager = Responsable ou co-gestionnaire ;
// managerRequest = { id, status, kind } | null ; claimPending = signalement en attente.
// Auth optional — returns all false / null if not logged in
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id requis." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      isCredited: false, hasPendingRequest: false, isOwner: false,
      isManager: false, managerRequest: null, claimPending: false,
    });
  }

  // Check if owner
  const { data: project } = await supabase
    .from("projects")
    .select("profile_id")
    .eq("id", projectId)
    .single();

  const isOwner = project?.profile_id === user.id;

  // Check if already credited
  const { count: creditCount } = await supabase
    .from("project_credits")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("profile_id", user.id);

  const isCredited = (creditCount ?? 0) > 0;

  // Check if pending request exists
  const { count: reqCount } = await supabase
    .from("credit_requests")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("requester_id", user.id)
    .eq("status", "pending");

  const hasPendingRequest = (reqCount ?? 0) > 0;

  // Gestionnaire = Responsable ou co-gestionnaire
  const { data: managerFlag } = await supabase.rpc("is_project_manager", { p_project_id: projectId });
  const isManager = isOwner || managerFlag === true;

  // Invitation / demande de co-gestion de l'utilisateur pour ce film
  const { data: managerRequest } = await supabase
    .from("project_manager_requests")
    .select("status, kind")
    .eq("project_id", projectId)
    .eq("profile_id", user.id)
    .maybeSingle();

  // Signalement / revendication en attente de l'utilisateur pour ce film
  const { count: claimCount } = await supabase
    .from("project_claims")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("claimant_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({
    isCredited, hasPendingRequest, isOwner,
    isManager,
    managerRequest: managerRequest ?? null,
    claimPending: (claimCount ?? 0) > 0,
  });
}
