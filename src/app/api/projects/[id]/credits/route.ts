import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { DISPLAY_NAME_COLUMNS, displayNameOf, type DisplayNameRow } from "@/lib/profile";
import { projectAccess } from "@/lib/project-invitations";

type Params = { params: Promise<{ id: string }> };

// GET: equipe d'un film pour l'onglet « Créditer » (gestionnaires du film).
// Trois sortes de lignes, lues en service role apres le controle du gestionnaire :
//  - member  : credit rattache a un profil (confirme) ;
//  - ghost   : credit sans compte, avec l'etat de son invitation par email
//              (en attente, expiree, ou aucune) ;
//  - invited : invitation a un membre, en attente de sa reponse (pas encore de credit).
// L'email d'une invitation n'est pas renvoye : il n'est pas utile a l'ecran.
// `is_owner` et `me` servent a l'ecran pour n'afficher que les actions permises ;
// chaque action est de nouveau controlee par sa route.
export async function GET(_request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { project, isOwner } = await projectAccess(supabase, admin, id, guard.user.id);
  if (!project) {
    return NextResponse.json({ error: "Réservé aux gestionnaires du film." }, { status: 403 });
  }

  const [{ data: credits, error: creditsError }, { data: emailInvites }, { data: memberInvites }] = await Promise.all([
    admin.from("project_credits").select("id, profile_id, ghost_name, role_on_project").eq("project_id", id),
    admin.from("invitations").select("id, credit_id, inviter_id, status, expires_at, resend_count").eq("project_id", id),
    admin
      .from("project_invitations")
      .select("id, invited_profile_id, inviter_id, role, created_at")
      .eq("project_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);
  if (creditsError) {
    console.error("[projects/credits] lecture :", creditsError);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }

  const profileIds = [
    ...new Set([
      ...(credits ?? []).map((c) => c.profile_id).filter((v): v is string => Boolean(v)),
      ...(memberInvites ?? []).map((i) => i.invited_profile_id),
    ]),
  ];
  const { data: profiles } = profileIds.length
    ? await admin.from("profiles").select(`id, ${DISPLAY_NAME_COLUMNS}, avatar_url, slug`).in("id", profileIds)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const person = (profileId: string) => {
    const p = byId.get(profileId);
    return { name: displayNameOf(p as DisplayNameRow | undefined) ?? "Membre", avatar_url: p?.avatar_url ?? null, slug: p?.slug ?? null };
  };

  const now = Date.now();
  const inviteByCredit = new Map((emailInvites ?? []).filter((i) => i.credit_id).map((i) => [i.credit_id as string, i]));

  const team = [
    ...(credits ?? []).map((c) => {
      if (c.profile_id) {
        return { kind: "member" as const, credit_id: c.id, profile_id: c.profile_id, role: c.role_on_project, ...person(c.profile_id) };
      }
      const inv = inviteByCredit.get(c.id);
      const expired = inv && (inv.status === "expired" || new Date(inv.expires_at).getTime() < now);
      return {
        kind: "ghost" as const,
        credit_id: c.id,
        role: c.role_on_project,
        name: c.ghost_name ?? "Sans nom",
        avatar_url: null,
        invitation: inv && inv.status !== "accepted"
          ? { id: inv.id, inviter_id: inv.inviter_id, state: expired ? ("expired" as const) : ("pending" as const), resend_count: inv.resend_count ?? 0 }
          : null,
      };
    }),
    ...(memberInvites ?? []).map((i) => ({
      kind: "invited" as const,
      invitation_id: i.id,
      profile_id: i.invited_profile_id,
      inviter_id: i.inviter_id,
      role: i.role,
      ...person(i.invited_profile_id),
    })),
  ];

  return NextResponse.json({ is_owner: isOwner, me: guard.user.id, team });
}
