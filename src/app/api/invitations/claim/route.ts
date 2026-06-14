import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/invitations/claim?token=<uuid>
// Résout une invitation email pour pré-remplir l'inscription (chantier 10).
//
// Anti-énumération : on ne révèle JAMAIS rien si le token est absent, invalide,
// expiré ou déjà consommé. Réponse générique { valid: false } dans tous ces cas
// (impossible de tester si une adresse a été invitée, ni de deviner un token).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const invalid = NextResponse.json({ valid: false });
  if (!token) return invalid;

  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("email, role, project_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!inv) return invalid;
  if (inv.status !== "pending") return invalid;
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return invalid;

  const { data: project } = await admin
    .from("projects")
    .select("title")
    .eq("id", inv.project_id)
    .single();

  // On renvoie le strict nécessaire pour pré-remplir + verrouiller l'email.
  return NextResponse.json({
    valid: true,
    email: inv.email,
    role: inv.role,
    project_title: project?.title ?? null,
  });
}
