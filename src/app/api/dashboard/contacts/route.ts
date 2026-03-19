import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: fetch contact requests received
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { data: contacts } = await supabase
    .from("contact_requests")
    .select("*")
    .eq("to_profile_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ contacts: contacts ?? [] });
}

// PATCH: update contact request status (accept/decline)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id || !["accepted", "declined"].includes(status)) {
    return NextResponse.json({ error: "ID et statut requis." }, { status: 400 });
  }

  const { error } = await supabase
    .from("contact_requests")
    .update({ status })
    .eq("id", id)
    .eq("to_profile_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
