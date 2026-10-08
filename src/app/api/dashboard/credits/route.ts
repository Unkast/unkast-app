import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DISPLAY_NAME_COLUMNS, displayNameOf } from "@/lib/profile";

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
