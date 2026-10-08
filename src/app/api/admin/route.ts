import { REFUSAL_REASONS, refusalMessages } from "@/lib/constants";
import { sendFilmRefusedEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { DISPLAY_NAME_COLUMNS, displayNameOf } from "@/lib/profile";
import { fetchVideoThumbnail } from "@/lib/oembed";
import { titleChangedALot } from "@/lib/title-change";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminId } from "@/lib/adminGuard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { recomputePlan, isProGrantType, ADMIN_GRANTABLE_TYPES, validateGrantExpiry } from "@/lib/pro-plan";

// GET: fetch admin dashboard data
export async function GET(request: NextRequest) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Non autorise." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "recruiters";
  const search = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const admin = createAdminClient();

  if (tab === "recruiters") {
    const { data: pending } = await admin.from("profiles")
      .select("id, full_name, slug, recruiter_company, recruiter_role, recruiter_website, recruiter_status, created_at")
      .eq("account_type", "recruiter").eq("recruiter_status", "pending")
      .order("created_at", { ascending: false });

    const { data: approved } = await admin.from("profiles")
      // `plan` : le badge « vérifié » est EFFECTIF seulement si le compte est Pro
      // (modele eco du 10/08/2026). L'admin doit voir les deux etats separement —
      // toggle pose vs badge reellement affiche au public (voir AdminClient).
      .select("id, full_name, slug, recruiter_company, recruiter_role, recruiter_website, recruiter_status, recruiter_verified, plan, is_suspended, created_at")
      .eq("account_type", "recruiter").eq("recruiter_status", "approved")
      .order("created_at", { ascending: false }).limit(50);

    // Modifications sensibles (description pro) en attente de re-validation.
    const { data: edits } = await admin.from("profiles")
      .select("id, full_name, slug, bio, bio_pending, recruiter_verified, plan, recruiter_company, created_at")
      .eq("recruiter_review_status", "pending")
      .order("created_at", { ascending: false });

    // Get emails from auth
    const enriched = async (items: typeof pending) => {
      if (!items) return [];
      return Promise.all(items.map(async (p) => {
        const { data: { user } } = await admin.auth.admin.getUserById(p.id);
        return { ...p, email: user?.email || "" };
      }));
    };

    return NextResponse.json({
      pending: await enriched(pending),
      approved: await enriched(approved),
      edits: edits ?? [],
    });
  }

  if (tab === "reports") {
    const { data: reports } = await admin.from("reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    // Enrich with reporter name and target info
    const enriched = await Promise.all((reports ?? []).map(async (r) => {
      // reporter_id NULL = signalement automatique (detecteur de coordonnees).
      const { data: reporter } = r.reporter_id
        ? await admin.from("profiles").select("full_name, slug").eq("id", r.reporter_id).single()
        : { data: { full_name: "Détection automatique", slug: "" } };
      let targetName = "";
      let targetSlug = "";
      let targetOwnerId = "";
      // Entree du Parcours : son contenu, et le profil concerne (target_name /
      // target_slug / target_owner_id portent le PROFIL, seule page ou l'ouvrir).
      let careerEntry: { title: string; role: string; year: number; production: string | null } | null = null;
      let messageRecipient: string | null = null;
      if (r.target_type === "career_entry") {
        const { data: t } = await admin.from("career_entries").select("title, role, year, production, profile_id").eq("id", r.target_id).maybeSingle();
        if (t) {
          const { data: owner } = await admin.from("profiles").select("full_name, slug").eq("id", t.profile_id).single();
          targetName = owner?.full_name || ""; targetSlug = owner?.slug || ""; targetOwnerId = t.profile_id;
          careerEntry = { title: t.title, role: t.role, year: t.year, production: t.production };
        }
      } else if (r.target_type === "profile") {
        const { data: t } = await admin.from("profiles").select("full_name, slug").eq("id", r.target_id).single();
        targetName = t?.full_name || ""; targetSlug = t?.slug || ""; targetOwnerId = r.target_id;
      } else if (r.target_type === "project") {
        const { data: t } = await admin.from("projects").select("title, slug, profile_id").eq("id", r.target_id).single();
        targetName = t?.title || ""; targetSlug = t?.slug || ""; targetOwnerId = t?.profile_id || "";
      } else if (r.target_type === "message") {
        // Message signale (detecteur de coordonnees) : l'expediteur est le profil
        // concerne ; le destinataire situe l'echange. Le contenu n'est pas relu
        // ici, l'extrait du signalement suffit.
        const { data: m } = await admin.from("messages").select("sender_id, conversation_id").eq("id", r.target_id).maybeSingle();
        if (m) {
          const { data: conv } = await admin.from("conversations").select("participant_1, participant_2").eq("id", m.conversation_id).maybeSingle();
          const recipientId = conv ? (conv.participant_1 === m.sender_id ? conv.participant_2 : conv.participant_1) : null;
          const { data: people } = await admin.from("profiles").select("id, full_name, slug").in("id", [m.sender_id, recipientId].filter(Boolean));
          const sender = people?.find((x) => x.id === m.sender_id);
          targetName = sender?.full_name || ""; targetSlug = sender?.slug || ""; targetOwnerId = m.sender_id;
          messageRecipient = people?.find((x) => x.id === recipientId)?.full_name ?? null;
        }
      }
      // Count total reports for this target
      const { count } = await admin.from("reports").select("id", { count: "exact", head: true })
        .eq("target_type", r.target_type).eq("target_id", r.target_id).eq("status", "pending");
      const total = count || 1;
      return { ...r, reporter_name: reporter?.full_name || "", target_name: targetName, target_slug: targetSlug, target_owner_id: targetOwnerId, career_entry: careerEntry, message_recipient: messageRecipient, total_reports: total, urgent: total >= 3 };
    }));

    // Alerte prioritaire : les cibles les plus signalees remontent en tete
    // (>= 3 = urgent). Pas de blocage automatique — l'admin tranche.
    enriched.sort((a, b) => b.total_reports - a.total_reports);

    return NextResponse.json({ reports: enriched });
  }

  if (tab === "users") {
    // pro_grant_type/pro_grant_expires_at/subscription_status : necessaires
    // pour que l'admin voie l'ORIGINE du Pro (Stripe / offert / recruteur),
    // pas seulement le badge plan opaque (chantier grants, 2026-08-10).
    let query = admin.from("profiles")
      .select("id, full_name, slug, account_type, plan, is_suspended, status, created_at, pro_grant_type, pro_grant_expires_at, subscription_status")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("full_name", `%${search}%`);
    }

    const offset = (page - 1) * 20;
    const { data, count } = await query.range(offset, offset + 19);

    const enriched = await Promise.all((data ?? []).map(async (p) => {
      const { data: { user } } = await admin.auth.admin.getUserById(p.id);
      return { ...p, email: user?.email || "" };
    }));

    return NextResponse.json({ users: enriched, total: count || 0, page });
  }

  if (tab === "films") {
    const { data: pending } = await admin.from("projects")
      .select("id, title, slug, category, year, video_url, poster_url, preview_url, profile_id, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const enriched = await Promise.all((pending ?? []).map(async (p) => {
      // profile_id NULL = film sans Responsable : owner_name / owner_slug vides.
      const { data: owner } = p.profile_id
        ? await admin.from("profiles").select("full_name, slug").eq("id", p.profile_id).single()
        : { data: null };
      // Titre et chaine renvoyes par oEmbed a la soumission (a comparer au film).
      const { data: moderation } = await admin.from("project_moderation")
        .select("source_title, source_author, source_duration").eq("project_id", p.id).maybeSingle();
      // Derniere declaration de droits.
      const { data: declaration } = await admin.from("project_rights_declarations")
        .select("declared_role").eq("project_id", p.id)
        .order("declared_at", { ascending: false }).limit(1).maybeSingle();
      return {
        ...p,
        owner_name: owner?.full_name || "",
        owner_slug: owner?.slug || "",
        source_title: moderation?.source_title ?? null,
        source_author: moderation?.source_author ?? null,
        // Duree en secondes (Vimeo seulement), null sinon.
        source_duration: moderation?.source_duration ?? null,
        declared_role: declaration?.declared_role ?? null,
      };
    }));

    // Films approuves modifies depuis leur validation (trigger track_project_edit),
    // plus recents d'abord. Seuls ceux A SURVEILLER sont listes : titre nettement
    // different du titre valide (lib/title-change), ou film signale (signalement
    // ou revendication en attente). Les petites modifications passent sans
    // apparaitre. mark_film_edit_seen les retire de la liste.
    const { data: edits } = await admin.from("project_moderation")
      .select("project_id, edited_at, edited_by, approved_title")
      .not("edited_at", "is", null)
      .order("edited_at", { ascending: false });

    const edited = (await Promise.all((edits ?? []).map(async (m) => {
      const { data: film } = await admin.from("projects").select("id, title, slug")
        .eq("id", m.project_id).eq("status", "approved").maybeSingle();
      if (!film) return null;
      const [{ count: reportCount }, { count: claimCount }] = await Promise.all([
        admin.from("reports").select("id", { count: "exact", head: true })
          .eq("target_type", "project").eq("target_id", film.id).eq("status", "pending"),
        admin.from("project_claims").select("id", { count: "exact", head: true })
          .eq("project_id", film.id).eq("status", "pending"),
      ]);
      const titleChanged = !!m.approved_title && titleChangedALot(m.approved_title, film.title);
      const reported = (reportCount ?? 0) + (claimCount ?? 0) > 0;
      if (!titleChanged && !reported) return null;
      const { data: editor } = m.edited_by
        ? await admin.from("profiles").select("full_name").eq("id", m.edited_by).single()
        : { data: null };
      return {
        ...film,
        edited_at: m.edited_at as string,
        edited_by_name: editor?.full_name || "",
        // Pourquoi le film est liste, et le titre valide a comparer.
        title_changed: titleChanged,
        reported,
        approved_title: (m.approved_title as string | null) ?? null,
      };
    }))).filter((f) => f !== null);

    // Films sans Responsable (compte supprime sans co-gestionnaire).
    const { data: orphans } = await admin.from("projects")
      .select("id, title, slug, status, visibility")
      .is("profile_id", null)
      .order("created_at", { ascending: false });

    return NextResponse.json({ films: enriched, edited, orphans: orphans ?? [] });
  }

  if (tab === "claims") {
    const { data: claims } = await admin.from("project_claims")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const enriched = await Promise.all((claims ?? []).map(async (c) => {
      const { data: film } = await admin.from("projects").select("title, slug").eq("id", c.project_id).single();
      const { data: claimant } = await admin.from("profiles").select("full_name, slug").eq("id", c.claimant_id).single();
      // Justificatif : bucket prive, lien signe valable 10 minutes.
      const { data: signed } = c.document_path
        ? await admin.storage.from("claims").createSignedUrl(c.document_path, 600)
        : { data: null };
      return {
        ...c,
        project_title: film?.title || "",
        project_slug: film?.slug || "",
        claimant_name: claimant?.full_name || "",
        claimant_slug: claimant?.slug || "",
        document_url: signed?.signedUrl ?? null,
      };
    }));

    return NextResponse.json({ claims: enriched });
  }

  return NextResponse.json({ error: "Tab invalide." }, { status: 400 });
}

// PATCH: admin actions
export async function PATCH(request: NextRequest) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Non autorise." }, { status: 403 });

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { action, target_id, reason } = body;
  const admin = createAdminClient();

  // Rattrapage des images de film : vignette de la video pour les films qui
  // n'ont aucune image (films anterieurs a la recuperation automatique). Ne
  // touche jamais une image existante. Par lots, pour tenir dans le delai d'une
  // requete : tant que `remaining` est vrai, relancer avec `offset: next_offset`
  // (les films sans vignette disponible restent sans image et sont sautes).
  if (action === "backfill_posters") {
    const BATCH = 20;
    const offset = Number.isInteger(body.offset) && body.offset > 0 ? (body.offset as number) : 0;
    const { data: films, error } = await admin.from("projects")
      .select("id, video_url").is("poster_url", null).neq("status", "refused")
      .order("created_at", { ascending: false }).range(offset, offset + BATCH);
    if (error) return NextResponse.json({ error: "Lecture des films impossible." }, { status: 500 });
    const batch = (films ?? []).slice(0, BATCH);
    let filled = 0;
    await Promise.all(batch.map(async (f) => {
      const thumbnail = await fetchVideoThumbnail(f.video_url);
      if (!thumbnail) return;
      const { error: writeError } = await admin.from("projects")
        .update({ poster_url: thumbnail }).eq("id", f.id).is("poster_url", null);
      if (!writeError) filled++;
    }));
    await admin.from("admin_logs").insert({
      admin_id: adminId, action: "backfill_posters", target_type: "project", target_id: adminId,
      details: { checked: batch.length, filled },
    });
    return NextResponse.json({
      success: true, checked: batch.length, filled,
      remaining: (films ?? []).length > BATCH,
      next_offset: offset + batch.length - filled,
    });
  }

  // Auto-protection : refuse les actions qui, appliquees a soi-meme, sortiraient
  // l'admin du back-office (suspension) ou degraderaient son propre statut
  // recruteur. Les actions "avantage a soi" (grant_pro, approve_*) restent
  // permises : admin unique, les bloquer imposerait du SQL manuel — admin_logs
  // trace tout. revoke_pro_grant sur soi reste permis pour la meme raison
  // (inoffensif : retire un avantage, ne degrade aucun statut structurel).
  // revoke_recruiter_approval rejoint SELF_BLOCKED_ACTIONS le 2026-08-10 —
  // meme famille que reject_recruiter, degraderait le statut recruteur de
  // l'admin qui l'appliquerait a lui-meme.
  // Films et signalements (approve_film, refuse_film, dismiss_report) : hors
  // perimetre, meme raison (decision produit du 07/08/2026).
  const SELF_BLOCKED_ACTIONS = ["suspend_user", "reject_recruiter", "revoke_recruiter_verified", "revoke_recruiter_approval"];
  if (SELF_BLOCKED_ACTIONS.includes(action) && target_id === adminId) {
    // Journalisation best-effort : le refus tient meme si le log echoue,
    // contrairement a finalize() ou l'ecriture metier a deja porte.
    await admin.from("admin_logs").insert({
      admin_id: adminId,
      action: "self_action_blocked",
      target_type: "profile",
      target_id,
      details: { attempted_action: action, reason: reason ?? null },
    });
    return NextResponse.json(
      { error: "Auto-protection : un admin ne peut pas appliquer cette action à son propre compte." },
      { status: 403 }
    );
  }

  // Fiabilite (audit) : chaque action = une ecriture metier + une ligne d'audit,
  // et CHAQUE ecriture est verifiee — plus de success renvoye sur echec.
  // finalize() mutualise : echec metier -> 500 explicite ; sinon journalisation
  // admin_logs, elle aussi verifiee (si elle echoue, l'action a DEJA porte :
  // on le dit tel quel plutot que de pretendre a un echec complet).
  async function finalize(
    writeError: { message: string } | null,
    actionName: string,
    targetType: string,
    details: Record<string, unknown> = {}
  ) {
    if (writeError) {
      return NextResponse.json(
        { error: `Échec de l'action ${actionName} : ${writeError.message}` },
        { status: 500 }
      );
    }
    const { error: logError } = await admin
      .from("admin_logs")
      .insert({ admin_id: adminId, action: actionName, target_type: targetType, target_id, details });
    if (logError) {
      return NextResponse.json(
        { error: `Action ${actionName} appliquée, mais journal admin non écrit : ${logError.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  }

  // Approve recruiter — approuve le STATUT, rien d'autre. La règle "recruiter ⇒
  // pro" est morte le 2026-08-10 (nouveau modèle économique) : le Pro s'achète
  // (9,99 €) ou s'offre explicitement (grant_pro), il ne se gagne plus en étant
  // approuvé. Un recruteur approuvé mais free garde son statut et son
  // éligibilité au badge « vérifié » — le badge ne s'affiche au public que s'il
  // est AUSSI Pro (double condition, arbitrée à l'affichage : rien à recalculer
  // ici, et une résiliation Stripe retire le badge sans action admin).
  // Pas d'écriture de grant, donc pas de recomputePlan : `plan` ne dépend plus
  // de cette action.
  if (action === "approve_recruiter") {
    const { error } = await admin.from("profiles").update({
      recruiter_status: "approved",
    }).eq("id", target_id);
    return finalize(error, "approve_recruiter", "profile");
  }

  // Reject recruiter
  if (action === "reject_recruiter") {
    const { error } = await admin.from("profiles").update({ recruiter_status: "rejected" }).eq("id", target_id);
    return finalize(error, "reject_recruiter", "profile", { reason });
  }

  // Suspend user
  if (action === "suspend_user") {
    const { error } = await admin.from("profiles").update({ is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason || null }).eq("id", target_id);
    return finalize(error, "suspend_user", "profile", { reason });
  }

  // Reactivate user
  if (action === "reactivate_user") {
    const { error } = await admin.from("profiles").update({ is_suspended: false, suspended_at: null, suspended_reason: null }).eq("id", target_id);
    return finalize(error, "reactivate_user", "profile");
  }

  // Accorder un Pro offert (ex-set_pro, renomme le 2026-08-10 — le nom
  // different dans admin_logs date volontairement le passage au modele
  // grant). Types posables a la main : launch, vip — voir ADMIN_GRANTABLE_TYPES.
  // ⚠️ Jusqu'au 2026-08-10 (meme jour), un troisieme type 'recruiter' existait
  // et cette action refusait explicitement de l'ecraser (garde-fou 400). Ce
  // type a ete retire du modele (approve_recruiter ne le pose plus, stock
  // purge, CHECK Postgres resserre — voir 20260810_pro_grants_type_cleanup.sql)
  // : isProGrantType()/ADMIN_GRANTABLE_TYPES rejettent deja toute valeur hors
  // {launch, vip} en amont, le garde-fou dedie n'a donc plus d'objet.
  if (action === "grant_pro") {
    const { grant_type, expires_at } = body;

    if (!isProGrantType(grant_type) || !ADMIN_GRANTABLE_TYPES.includes(grant_type)) {
      return NextResponse.json(
        { error: `Type de grant invalide. Valeurs acceptées : ${ADMIN_GRANTABLE_TYPES.join(", ")}.` },
        { status: 400 }
      );
    }

    // expires_at : ISO string ou null/absent. Toute autre valeur est rejetee
    // avant d'atteindre la base — evite un 500 Postgres brut si le champ est
    // mal forme cote client.
    let normalizedExpiresAt: string | null = null;
    if (expires_at !== undefined && expires_at !== null) {
      if (typeof expires_at !== "string" || Number.isNaN(Date.parse(expires_at))) {
        return NextResponse.json({ error: "Échéance invalide (date ISO attendue)." }, { status: 400 });
      }
      normalizedExpiresAt = expires_at;
    }

    // Meme regle que le CHECK Postgres profiles_pro_grant_expiry_check, mais
    // avec un message clair plutot qu'une erreur 500 brute si violee.
    const validationError = validateGrantExpiry(grant_type, normalizedExpiresAt);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { error } = await admin.from("profiles").update({
      pro_grant_type: grant_type,
      pro_grant_expires_at: normalizedExpiresAt,
      pro_grant_granted_by: adminId,
      pro_grant_granted_at: new Date().toISOString(),
    }).eq("id", target_id);
    if (error) {
      return NextResponse.json({ error: `Échec de l'action grant_pro : ${error.message}` }, { status: 500 });
    }

    const { error: recomputeError } = await recomputePlan(admin, target_id);
    if (recomputeError) {
      return NextResponse.json(
        { error: `Grant enregistré, mais recalcul du plan échoué : ${recomputeError.message}. Le compte peut ne pas encore refléter le Pro.` },
        { status: 500 }
      );
    }

    return finalize(null, "grant_pro", "profile", { grant_type, expires_at: normalizedExpiresAt });
  }

  // Retirer un Pro offert (launch/vip). ⚠️ Jusqu'au 2026-08-10, le grant
  // 'recruiter' etait EXCLU de cette action (garde-fou 400 : il ne se retirait
  // que via revoke_recruiter_approval). Ce type n'existe plus dans le modele
  // (voir grant_pro ci-dessus) — plus aucun profil ne peut porter cette
  // valeur, le garde-fou dedie n'a donc plus d'objet.
  if (action === "revoke_pro_grant") {
    const { error } = await admin.from("profiles").update({
      pro_grant_type: null,
      pro_grant_expires_at: null,
      pro_grant_granted_by: null,
      pro_grant_granted_at: null,
      pro_grant_reminder_sent_at: null,
    }).eq("id", target_id);
    if (error) {
      return NextResponse.json({ error: `Échec de l'action revoke_pro_grant : ${error.message}` }, { status: 500 });
    }

    const { error: recomputeError } = await recomputePlan(admin, target_id);
    if (recomputeError) {
      return NextResponse.json(
        { error: `Grant retiré, mais recalcul du plan échoué : ${recomputeError.message}. Le compte peut rester Pro à tort.` },
        { status: 500 }
      );
    }

    return finalize(null, "revoke_pro_grant", "profile");
  }

  // Révoquer un statut recruteur préalablement approuvé (ex. fraude détectée
  // après coup) — distinct de reject_recruiter, qui ne s'applique qu'à une
  // candidature encore pending. ⚠️ Jusqu'au 2026-08-10, cette action retirait
  // aussi le grant 'recruiter' que approve_recruiter posait à l'approbation
  // (les deux se retiraient ensemble, sinon le profil restait "approuvé" mais
  // Pro à vie sans grant valide). Depuis le nouveau modèle économique,
  // approve_recruiter ne pose plus aucun grant — il n'y a donc plus rien à
  // nettoyer ici. Un recruteur dont on révoque l'approbation était déjà free
  // ou Pro par une source indépendante (Stripe, ou un grant launch/vip posé
  // séparément) ; cette action ne touche à aucune des deux.
  if (action === "revoke_recruiter_approval") {
    const { error } = await admin.from("profiles").update({ recruiter_status: "rejected" }).eq("id", target_id);
    return finalize(error, "revoke_recruiter_approval", "profile", { reason });
  }

  // Approve film
  if (action === "approve_film") {
    const { data: approved, error } = await admin.from("projects")
      .update({ status: "approved" }).eq("id", target_id).select("title").maybeSingle();
    // Titre valide : reference de la liste « modifies recemment ».
    if (!error && approved) {
      await admin.from("project_moderation")
        .upsert(
          // Un film reapprouve apres un refus perd son motif.
          { project_id: target_id, approved_title: approved.title, refusal_reasons: null, refusal_note: null },
          { onConflict: "project_id" }
        );
    }
    // L'index unique sur video_key exclut les films refuses : reapprouver un film
    // refuse echoue si une autre fiche a pris sa video entre-temps.
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Une autre fiche utilise déjà cette vidéo : ce film ne peut pas être réapprouvé tel quel." },
        { status: 409 }
      );
    }
    return finalize(error, "approve_film", "project");
  }

  // Refuse film
  // Corps : { reasons: string[] (REFUSAL_REASONS), note?: string }. Au moins un
  // motif ; « autre » exige une note. Le motif est garde (carte du film refuse
  // dans « Mes films »), puis envoye au Responsable seul, par email et par push.
  if (action === "refuse_film") {
    const reasons: string[] = Array.isArray(body.reasons)
      ? [...new Set((body.reasons as unknown[]).filter((r): r is string => REFUSAL_REASONS.some((x) => x.value === r)))]
      : [];
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null;
    if (reasons.length === 0) {
      return NextResponse.json({ error: "Choisis au moins un motif." }, { status: 400 });
    }
    if (reasons.includes("autre") && !note) {
      return NextResponse.json({ error: "Précise le motif « Autre »." }, { status: 400 });
    }

    // Le motif d'abord : s'il ne s'enregistre pas, le film n'est pas refuse (un
    // refus sans motif visible dans « Mes films » serait incomprehensible).
    const { error: moderationError } = await admin.from("project_moderation")
      .upsert({ project_id: target_id, refusal_reasons: reasons, refusal_note: note }, { onConflict: "project_id" });
    if (moderationError) return finalize(moderationError, "refuse_film", "project");

    const { data: film, error } = await admin.from("projects")
      .update({ status: "refused" }).eq("id", target_id).select("title, profile_id").maybeSingle();
    if (error || !film) {
      return finalize(error ?? { message: "film introuvable" }, "refuse_film", "project");
    }

    // Message au Responsable : jamais bloquant, le refus a deja porte.
    let emailSent = false;
    if (film.profile_id) {
      const [{ data: owner }, { data: auth }] = await Promise.all([
        admin.from("profiles").select(DISPLAY_NAME_COLUMNS).eq("id", film.profile_id).maybeSingle(),
        admin.auth.admin.getUserById(film.profile_id),
      ]);
      const to = auth?.user?.email;
      if (to) {
        const res = await sendFilmRefusedEmail({
          to,
          name: displayNameOf(owner) ?? "",
          projectTitle: film.title,
          reasons: refusalMessages(reasons),
          note,
        });
        emailSent = res.sent;
      }
      sendPushToUser(film.profile_id, {
        title: "Film non retenu",
        body: `Ton film « ${film.title} » n'a pas été retenu. Ouvre Mes films pour voir pourquoi.`,
        url: "/moi",
      }).catch(() => {});
    }
    return finalize(null, "refuse_film", "project", { reasons, note, email_sent: emailSent });
  }

  // --- Gestion des films (migration 20261008_film_management.sql) ---

  // Modification d'un film approuve : vue par l'admin, elle quitte la liste, et
  // le titre actuel devient le titre valide.
  if (action === "mark_film_edit_seen") {
    const { data: film } = await admin.from("projects").select("title").eq("id", target_id).maybeSingle();
    const { error } = await admin.from("project_moderation")
      .update({ edited_at: null, edited_by: null, ...(film ? { approved_title: film.title } : {}) })
      .eq("project_id", target_id);
    return finalize(error, "mark_film_edit_seen", "project");
  }

  // Signalement / revendication d'un film : la decision seule. Attribuer le film
  // au demandeur est une action distincte (assign_project_owner).
  if (action === "accept_claim" || action === "reject_claim") {
    const { error } = await admin.from("project_claims").update({
      status: action === "accept_claim" ? "accepted" : "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", target_id);
    return finalize(error, action, "project_claim", { reason });
  }

  // Poser le Responsable d'un film (film sans Responsable, revendication
  // acceptee). Ne touche ni a status ni a visibility.
  if (action === "assign_project_owner") {
    const { profile_id } = body;
    const { data: film } = await admin.from("projects").select("id, profile_id").eq("id", target_id).maybeSingle();
    if (!film) return NextResponse.json({ error: "Film introuvable." }, { status: 404 });
    const { data: newOwner } = profile_id
      ? await admin.from("profiles").select("id").eq("id", profile_id).maybeSingle()
      : { data: null };
    if (!newOwner) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });

    const { error } = await admin.from("projects").update({ profile_id }).eq("id", target_id);
    if (error) return finalize(error, "assign_project_owner", "project");

    // Le Responsable ne figure jamais parmi les co-gestionnaires.
    const { error: managerError } = await admin.from("project_managers")
      .delete().eq("project_id", target_id).eq("profile_id", profile_id);
    return finalize(managerError, "assign_project_owner", "project", { profile_id, previous_profile_id: film.profile_id });
  }

  // Supprimer une entree du Parcours (signalement).
  if (action === "delete_career_entry") {
    const { error } = await admin.from("career_entries").delete().eq("id", target_id);
    // L'entree n'existe plus : ses signalements en attente sont clos avec elle.
    if (!error) {
      await admin.from("reports")
        .update({ status: "resolved", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq("target_type", "career_entry").eq("target_id", target_id).eq("status", "pending");
    }
    return finalize(error, "delete_career_entry", "career_entry", { reason });
  }

  // --- Re-verification de la description pro d'un recruteur (chantier 2) ---

  // Approuver la modif : la version en attente devient publique.
  if (action === "approve_recruiter_edit") {
    const { data: target, error: readError } = await admin.from("profiles").select("bio_pending").eq("id", target_id).single();
    // Sans lecture fiable du brouillon, on n'ecrase PAS la bio publique
    // (sinon une lecture en echec publierait bio=null).
    if (readError || !target) {
      return NextResponse.json({ error: "Profil cible introuvable ou illisible." }, { status: 404 });
    }
    const { error } = await admin.from("profiles").update({
      bio: target.bio_pending ?? null,
      bio_pending: null,
      recruiter_review_status: "none",
      recruiter_review_reason: null,
    }).eq("id", target_id);
    return finalize(error, "approve_recruiter_edit", "profile");
  }

  // Refuser la modif : on garde l'ancienne version publique, on jette le brouillon.
  // Le motif est stocke sur le profil (recruiter_review_reason) pour etre lisible
  // par le recruteur via GET /api/dashboard/profile — admin_logs ne lui est pas
  // accessible. Nettoye a l'approbation et a toute nouvelle soumission.
  if (action === "reject_recruiter_edit") {
    const { error } = await admin.from("profiles").update({
      bio_pending: null,
      recruiter_review_status: "rejected",
      recruiter_review_reason: reason || null,
    }).eq("id", target_id);
    return finalize(error, "reject_recruiter_edit", "profile", { reason });
  }

  // Accorder le badge "recruteur verifie".
  if (action === "grant_recruiter_verified") {
    const { error } = await admin.from("profiles").update({ recruiter_verified: true, recruiter_verified_at: new Date().toISOString() }).eq("id", target_id);
    return finalize(error, "grant_recruiter_verified", "profile");
  }

  // Retirer le badge "recruteur verifie".
  if (action === "revoke_recruiter_verified") {
    const { error } = await admin.from("profiles").update({ recruiter_verified: false, recruiter_verified_at: null }).eq("id", target_id);
    return finalize(error, "revoke_recruiter_verified", "profile", { reason });
  }

  // Dismiss report
  if (action === "dismiss_report") {
    const { error } = await admin.from("reports").update({ status: "dismissed", reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("id", target_id);
    return finalize(error, "dismiss_report", "report");
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
