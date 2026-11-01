import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cron Vercel (vercel.json, une fois par jour) : tient les durees de conservation
// promises dans /confidentialite et /supprimer-mon-compte.
//
// Deux passes INDEPENDANTES : l'echec de l'une n'empeche jamais l'autre.
//   1. rate_limits : lignes dont la fenetre a demarre il y a plus de 7 jours.
//      La plus longue fenetre du code est de 1 jour (invite:*, claim:*) : 7 jours
//      ne remet jamais une limite en cours a zero. Les cles contiennent des IP,
//      des identifiants de compte et des emails.
//   2. Justificatifs de revendication (project_claims.document_path, bucket prive
//      claims) : fichier supprime 1 an apres la decision (reviewed_at). La ligne
//      est GARDEE (historique de moderation), seul document_path est vide, et
//      seulement si la suppression du Storage a reussi.
//
// Meme authentification que /api/cron/pro-expiry : Vercel envoie
// `Authorization: Bearer ${CRON_SECRET}`, verifie avant toute autre chose.

const RATE_LIMIT_RETENTION_DAYS = 7;
const CLAIM_DOCUMENT_RETENTION_DAYS = 365;
// Plafond par passage : le reste part les jours suivants.
const CLAIMS_PER_RUN = 500;

const daysAgoIso = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

type Admin = ReturnType<typeof createAdminClient>;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminClient();
  const [rateLimits, claimDocuments] = await Promise.all([purgeRateLimits(admin), purgeClaimDocuments(admin)]);
  const failed = rateLimits.error !== null || claimDocuments.error !== null;

  return NextResponse.json({ rate_limits: rateLimits, claim_documents: claimDocuments }, { status: failed ? 500 : 200 });
}

async function purgeRateLimits(admin: Admin) {
  try {
    const { count, error } = await admin
      .from("rate_limits")
      .delete({ count: "exact" })
      .lt("window_start", daysAgoIso(RATE_LIMIT_RETENTION_DAYS));
    if (error) {
      console.error("[cron/retention] purge de rate_limits échouée :", error);
      return { deleted: 0, error: error.message };
    }
    return { deleted: count ?? 0, error: null };
  } catch (err) {
    console.error("[cron/retention] purge de rate_limits échouée :", err);
    return { deleted: 0, error: String(err) };
  }
}

async function purgeClaimDocuments(admin: Admin) {
  try {
    const { data, error } = await admin
      .from("project_claims")
      .select("id, document_path")
      .in("status", ["accepted", "rejected"])
      .lt("reviewed_at", daysAgoIso(CLAIM_DOCUMENT_RETENTION_DAYS))
      .not("document_path", "is", null)
      .order("reviewed_at")
      .limit(CLAIMS_PER_RUN);
    if (error) {
      console.error("[cron/retention] lecture des justificatifs échus échouée :", error);
      return { matched: 0, cleared: 0, error: error.message };
    }
    const claims = (data ?? []) as { id: string; document_path: string }[];
    if (!claims.length) return { matched: 0, cleared: 0, error: null };

    // Un fichier deja absent n'est pas une erreur pour le Storage : document_path
    // est alors vide aussi. Si l'appel echoue, rien n'est vide : nouvel essai demain.
    const { error: storageError } = await admin.storage.from("claims").remove(claims.map((c) => c.document_path));
    if (storageError) {
      console.error("[cron/retention] suppression des justificatifs dans le Storage échouée :", storageError);
      return { matched: claims.length, cleared: 0, error: storageError.message };
    }

    // UPDATE seulement, jamais de DELETE : la revendication reste en base.
    const { count, error: updateError } = await admin
      .from("project_claims")
      .update({ document_path: null }, { count: "exact" })
      .in("id", claims.map((c) => c.id));
    if (updateError) {
      // Fichiers partis, chemins encore en base : le prochain passage les revoit
      // (fichier deja absent) et vide les chemins.
      console.error("[cron/retention] fichiers supprimés mais document_path non vidé :", updateError);
      return { matched: claims.length, cleared: 0, error: updateError.message };
    }
    return { matched: claims.length, cleared: count ?? 0, error: null };
  } catch (err) {
    console.error("[cron/retention] purge des justificatifs échouée :", err);
    return { matched: 0, cleared: 0, error: String(err) };
  }
}
