import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/credits/status?project_id=...
// Returns { isCredited, hasPendingRequest, isOwner }
// Auth optional — returns all false if not logged in
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id requis." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isCredited: false, hasPendingRequest: false, isOwner: false });
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

  return NextResponse.json({ isCredited, hasPendingRequest, isOwner });
}
