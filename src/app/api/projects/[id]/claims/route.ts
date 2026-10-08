import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { invalidBodyResponse } from "@/lib/api";

// Extension deduite du type MIME, jamais du nom de fichier.
const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
// 4 Mo : Vercel refuse un corps de requete au-dela de 4,5 Mo.
const MAX_SIZE = 4 * 1024 * 1024;
const MAX_MESSAGE = 2000;

// POST: signaler un film ('report') ou le revendiquer ('claim'), traite par l'admin
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;
  const { id: projectId } = await params;

  // Anti-abus : 5 demandes par jour et par compte.
  if (!(await checkRateLimit(`claim:${user.id}`, 5, 86400))) {
    return NextResponse.json(
      { error: "Trop de demandes aujourd'hui. Réessaie demain." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return invalidBodyResponse();
  }
  const kind = formData.get("kind");
  const rawMessage = formData.get("message");
  const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
  const rawFile = formData.get("file");
  // Un champ fichier laisse vide arrive comme un fichier de taille 0.
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

  if (kind !== "report" && kind !== "claim") {
    return NextResponse.json({ error: "Type de demande invalide." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Message requis." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Message trop long (${MAX_MESSAGE} caractères maximum).` },
      { status: 400 }
    );
  }
  if (kind === "claim" && !file) {
    return NextResponse.json(
      { code: "file_required", error: "Un justificatif est requis pour revendiquer un film." },
      { status: 400 }
    );
  }
  // SECURITE : type et taille verifies cote serveur, avant tout envoi au Storage.
  if (file && !EXTENSIONS[file.type]) {
    return NextResponse.json(
      { error: "Format non supporté (PDF, JPEG, PNG ou WebP uniquement)." },
      { status: 400 }
    );
  }
  if (file && file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (4 Mo maximum)." },
      { status: 400 }
    );
  }

  // Le film doit exister, quel que soit son statut : une revendication peut viser
  // un film non public decouvert par un doublon.
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Film introuvable." }, { status: 404 });
  }

  // Bucket prive `claims` : aucune policy, service role uniquement.
  let documentPath: string | null = null;
  if (file) {
    documentPath = `${projectId}/${user.id}-${Date.now()}.${EXTENSIONS[file.type]}`;
    const { error: uploadError } = await admin.storage
      .from("claims")
      .upload(documentPath, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (uploadError) {
      console.error("[projects/claims] envoi du justificatif:", uploadError);
      return NextResponse.json({ error: "Envoi du justificatif impossible." }, { status: 500 });
    }
  }

  const { error } = await admin.from("project_claims").insert({
    project_id: projectId,
    claimant_id: user.id,
    kind,
    message,
    document_path: documentPath,
  });

  if (error) {
    // La demande n'est pas enregistree : le fichier envoye ne doit pas rester orphelin.
    if (documentPath) {
      await admin.storage.from("claims").remove([documentPath]).catch(() => {});
    }
    // 23505 : index project_claims_one_pending (une demande en attente par film et par personne).
    if (error.code === "23505") {
      return NextResponse.json(
        { code: "already_pending", error: "Tu as déjà une demande en cours pour ce film." },
        { status: 409 }
      );
    }
    console.error("[projects/claims] enregistrement:", error);
    return NextResponse.json({ error: "Erreur lors de l'envoi de la demande." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
