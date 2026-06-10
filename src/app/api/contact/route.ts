import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { checkRateLimit, getClientIp, isValidEmail } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Anti-spam : max 10 demandes de contact par heure et par IP.
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`contact:${ip}`, 10, 3600))) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessaie plus tard." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { from_name, from_email, to_profile_id, subject, message } = body;

  if (!from_name || !from_email || !to_profile_id || !subject || !message) {
    return NextResponse.json(
      { error: "Tous les champs sont requis." },
      { status: 400 }
    );
  }
  if (!isValidEmail(from_email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  const supabase = await createClient();

  // Vérifier que le profil cible existe et est approuvé (pas d'insertion vers un UUID arbitraire).
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", to_profile_id)
    .eq("status", "approved")
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

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

  // Notify profile owner
  const subjectLabels: Record<string, string> = {
    collaboration: "Collaboration",
    project: "Projet",
    question: "Question",
    other: "Message",
  };

  sendPushToUser(to_profile_id, {
    title: `${subjectLabels[subject] || "Message"} de ${from_name}`,
    body: message.length > 100 ? message.slice(0, 100) + "..." : message,
    url: "/dashboard/contacts",
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
