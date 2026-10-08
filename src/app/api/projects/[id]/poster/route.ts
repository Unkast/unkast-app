import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { fetchVideoThumbnail } from "@/lib/oembed";

// Image du film (projects.poster_url). Par defaut : la vignette de la video.
// Un gestionnaire (Responsable ou co-gestionnaire) peut la remplacer par une
// image envoyee, ou revenir a celle de la video. Aucune validation admin, et
// rien dans « modifies recemment » (le suivi ne regarde pas l'image).
//
// La colonne est protegee par le trigger guard_projects_columns : elle ne
// s'ecrit qu'ici, avec le service role, apres controle du gestionnaire.

type Params = { params: Promise<{ id: string }> };

const BUCKET = "posters";
// L'image arrive deja recadree en 16:9 et compressee par le navigateur
// (1280 x 720, WebP). Ce plafond est le vrai rempart : il tient sous la limite
// de 4,5 Mo d'une requete Vercel et bloque tout contournement du navigateur.
const MAX_SIZE = 4 * 1024 * 1024;

// Type REEL du fichier, lu dans ses premiers octets (pas l'extension, pas le
// type annonce par le navigateur).
function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  if (at(0, 0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  // RIFF....WEBP
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return { mime: "image/webp", ext: "webp" };
  return null;
}

// Authentifie, puis verifie que l'utilisateur gere ce film (RPC is_project_manager).
// Renvoie la reponse d'erreur, ou null si tout va bien.
async function refuseUnlessManager(projectId: string): Promise<NextResponse | null> {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { data: isManager, error } = await supabase.rpc("is_project_manager", { p_project_id: projectId });
  if (error) {
    // 22P02 : identifiant qui n'est pas un uuid.
    if (error.code === "22P02") return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    console.error("[projects/poster] controle du gestionnaire:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  if (!isManager) {
    return NextResponse.json({ error: "Réservé aux gestionnaires du film." }, { status: 403 });
  }
  return null;
}

// Supprime les images envoyees pour ce film (une seule est utile a la fois).
async function removeUploads(admin: ReturnType<typeof createAdminClient>, projectId: string, keep?: string) {
  const { data: files } = await admin.storage.from(BUCKET).list(projectId);
  const paths = (files ?? []).map((f) => `${projectId}/${f.name}`).filter((p) => p !== keep);
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);
}

// POST: remplacer l'image du film par une image envoyee (multipart, champ `file`)
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const refusal = await refuseUnlessManager(id);
  if (refusal) return refusal;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image requise." }, { status: 400 });
  }
  // Taille AVANT de charger le fichier en memoire.
  if (file.size === 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image trop lourde (4 Mo maximum après compression)." }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buffer);
  if (!kind) {
    return NextResponse.json({ error: "Format non supporté (JPEG, PNG ou WebP uniquement)." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Nom horodate : l'URL change a chaque envoi, aucun cache ne sert l'ancienne image.
  const path = `${id}/${Date.now()}.${kind.ext}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: kind.mime, cacheControl: "31536000" });
  if (uploadError) {
    console.error("[projects/poster] envoi:", uploadError);
    return NextResponse.json({ error: "Erreur lors de l'envoi de l'image." }, { status: 500 });
  }

  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await admin.from("projects").update({ poster_url: url }).eq("id", id);
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    console.error("[projects/poster] enregistrement:", error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement de l'image." }, { status: 500 });
  }
  // L'ancienne image envoyee n'est retiree qu'une fois la nouvelle en place.
  await removeUploads(admin, id, path);

  return NextResponse.json({ success: true, poster_url: url });
}

// DELETE: revenir a l'image de la video
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const refusal = await refuseUnlessManager(id);
  if (refusal) return refusal;

  const admin = createAdminClient();
  const { data: project } = await admin.from("projects").select("video_url").eq("id", id).maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Film introuvable." }, { status: 404 });
  }

  // Vignette relue chez YouTube / Vimeo ; null si elle est introuvable (le film
  // s'affiche alors sans image).
  const thumbnail = await fetchVideoThumbnail(project.video_url);
  const { error } = await admin.from("projects").update({ poster_url: thumbnail }).eq("id", id);
  if (error) {
    console.error("[projects/poster] retour a la vignette:", error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement de l'image." }, { status: 500 });
  }
  await removeUploads(admin, id);

  return NextResponse.json({ success: true, poster_url: thumbnail });
}
