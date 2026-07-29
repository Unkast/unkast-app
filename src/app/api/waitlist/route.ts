import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, isValidEmail } from "@/lib/rate-limit";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

export async function POST(request: NextRequest) {
  // Anti-spam : max 5 inscriptions waitlist par heure et par IP.
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`waitlist:${ip}`, 5, 3600))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie plus tard." },
      { status: 429 }
    );
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { email, type, name, company, message } = body;

  if (!email || !type) {
    return NextResponse.json({ error: "Email et type requis." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("waitlist").insert({
    email,
    type,
    name: name || null,
    company: company || null,
    message: message || null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Tu es deja sur la liste d'attente." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
