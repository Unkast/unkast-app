import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST: upload avatar
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Fichier requis." }, { status: 400 });
  }

  // SÉCURITÉ : valider le type et la taille AVANT de charger le fichier en mémoire.
  // Sans ça : un appel direct à l'API peut envoyer un fichier de plusieurs Go
  // (DoS mémoire via arrayBuffer) ou un contenu non-image servi en image/jpeg.
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

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
  const fileName = `${user.id}/avatar.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(fileName, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(fileName);
  const url = urlData.publicUrl + "?t=" + Date.now();

  // Update profile
  await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);

  return NextResponse.json({ url });
}

// DELETE: remove avatar
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const admin = createAdminClient();
  await admin.storage.from("avatars").remove([`${user.id}/avatar.jpg`]);
  await admin.from("profiles").update({ avatar_url: null }).eq("id", user.id);

  return NextResponse.json({ success: true });
}
