import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { from_name, from_email, to_profile_id, subject, message } = body;

  if (!from_name || !from_email || !to_profile_id || !subject || !message) {
    return NextResponse.json(
      { error: "Tous les champs sont requis." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.from("contact_requests").insert({
    from_name,
    from_email,
    to_profile_id,
    subject,
    message,
  });

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de la demande." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
