import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendInvitationEmail } from "@/lib/email";
import { projectAccess } from "@/lib/project-invitations";

type Params = { params: Promise<{ id: string }> };

// 3 renvois au plus par invitation (decision du 30/10/2026). Filet en base :
// CHECK invitations_resend_count_check (migration 20261031_invitation_resends.sql).
const MAX_RESENDS = 3;
const VALIDITY_MS = 30 * 24 * 3600 * 1000; // meme duree que le defaut en base

// POST: renvoyer une invitation PAR EMAIL en attente ou expiree : nouveau lien
// (l'ancien ne fonctionne plus), nouvelle echeance a 30 jours, nouvel email.
// Gestionnaires du film (Responsable et co-gestionnaires). Compte dans la limite
// de 5 invitations par jour, comme un premier envoi.
export async function POST(_request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, project_id, email, role, status, resend_count")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });

  const { project } = await projectAccess(supabase, admin, inv.project_id, guard.user.id);
  if (!project) {
    return NextResponse.json({ error: "Réservé aux gestionnaires du film." }, { status: 403 });
  }
  if (inv.status === "accepted") {
    return NextResponse.json({ error: "Cette invitation a déjà été acceptée." }, { status: 409 });
  }
  const count = inv.resend_count ?? 0;
  if (count >= MAX_RESENDS) {
    return NextResponse.json({ error: `Cette invitation a déjà été renvoyée ${MAX_RESENDS} fois.` }, { status: 409 });
  }
  if (!(await checkRateLimit(`invite:${guard.user.id}`, 5, 86400))) {
    return NextResponse.json({ error: "Limite de 5 invitations par jour atteinte. Réessaie demain." }, { status: 429 });
  }

  const token = crypto.randomUUID();
  // Le filtre sur resend_count ferme la course entre deux renvois simultanes.
  const { data: updated, error } = await admin
    .from("invitations")
    .update({
      token,
      status: "pending",
      expires_at: new Date(Date.now() + VALIDITY_MS).toISOString(),
      resend_count: count + 1,
    })
    .eq("id", id)
    .eq("resend_count", count)
    .select("id");
  if (error) {
    console.error("[invitations/resend] mise a jour :", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Invitation déjà renvoyée entre-temps. Recharge la liste." }, { status: 409 });
  }

  await sendInvitationEmail({
    to: inv.email,
    inviterName: guard.profile.display_name || "Un membre d'Unkast",
    role: inv.role,
    projectTitle: project.title,
    token,
  });

  return NextResponse.json({ success: true, resends_left: MAX_RESENDS - count - 1 });
}
