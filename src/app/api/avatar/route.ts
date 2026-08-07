import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";

// POST: upload avatar
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Fichier requis." }, { status: 400 });
  }

  // SÉCURITÉ : valider le type et la taille AVANT de charger le fichier en mémoire.
  // Sans ça : un appel direct à l'API peut envoyer un fichier de plusieurs Go
  // (DoS mémoire via arrayBuffer) ou un contenu non-image servi en image/jpeg.
  // L'image arrive déjà compressée en WebP (canvas client, 512px). Le plafond
  // serveur est le VRAI rempart anti-saturation : il bloque tout contournement
  // de la compression navigateur. Marge large vs un WebP 512px (~30–60 Ko).
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE = 3 * 1024 * 1024; // 3 Mo

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté (JPEG, PNG ou WebP uniquement)." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (5 Mo maximum)." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const fileName = `${user.id}/avatar.webp`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(fileName, buffer, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Ménage : on retire l'ancien avatar JPEG (format précédent) pour ne pas
  // laisser d'orphelin dans le bucket. Best-effort, sans bloquer la réponse.
  await admin.storage.from("avatars").remove([`${user.id}/avatar.jpg`]).catch(() => {});

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(fileName);
  const url = urlData.publicUrl + "?t=" + Date.now();

  // Update profile
  await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);

  return NextResponse.json({ url });
}

// DELETE: remove avatar
export async function DELETE() {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const admin = createAdminClient();
  // Retire le format courant (.webp) ET l'éventuel ancien .jpg (legacy).
  await admin.storage.from("avatars").remove([`${user.id}/avatar.webp`, `${user.id}/avatar.jpg`]);
  await admin.from("profiles").update({ avatar_url: null }).eq("id", user.id);

  return NextResponse.json({ success: true });
}
