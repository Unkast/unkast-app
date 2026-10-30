import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { passwordError, PASSWORD_MISMATCH, weakPasswordMessage } from "@/lib/password";

// POST { password, confirm } : nouveau mot de passe de l'utilisateur connecte.
// Appelee par /auth/nouveau-mot-de-passe, juste apres l'ouverture de session par
// le lien « mot de passe oublie ». Meme regle que le formulaire, controlee ici.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Ta session a expiré. Redemande un lien depuis « Mot de passe oublié »." },
      { status: 401 }
    );
  }

  if (!(await checkRateLimit(`pw-update:${user.id}`, 10, 3600))) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans une heure." }, { status: 429 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { password, confirm } = body;

  const invalid = passwordError(password);
  if (invalid) return NextResponse.json({ code: "password_invalid", error: invalid }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json({ code: "password_mismatch", error: PASSWORD_MISMATCH }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return NextResponse.json({ error: "Choisis un mot de passe différent de l'ancien." }, { status: 400 });
    }
    if (error.code === "weak_password") {
      const reasons = "reasons" in error ? (error.reasons as string[]) : undefined;
      return NextResponse.json({ code: "password_invalid", error: weakPasswordMessage(reasons) }, { status: 400 });
    }
    console.error("[update-password] updateUser error:", error);
    return NextResponse.json({ error: "Enregistrement impossible. Réessaie dans un instant." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
