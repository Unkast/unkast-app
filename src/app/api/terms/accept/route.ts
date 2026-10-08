import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { TERMS_VERSION } from "@/lib/legal";

// POST: accepter les CGU et la politique de confidentialite en vigueur.
// Corps : { accepted: true }. Ecran « Les CGU ont ete mises a jour » (membres
// inscrits avant les pages legales, ou apres un changement de version), et fin
// de l'inscription par Google.
//
// Pas de getActiveUser : un compte suspendu doit pouvoir accepter aussi, et la
// route n'ecrit que sur la ligne de l'utilisateur connecte. Les deux colonnes
// n'ont aucun droit client : ecriture par le service role uniquement.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  if (body.accepted !== true) {
    return NextResponse.json(
      { error: "Coche la case pour accepter les CGU et la politique de confidentialité." },
      { status: 400 }
    );
  }

  const { data: updated, error } = await createAdminClient()
    .from("profiles")
    .update({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id");
  if (error || !updated?.length) {
    console.error("[terms/accept] enregistrement:", error);
    return NextResponse.json({ error: "Enregistrement impossible, réessaie." }, { status: 500 });
  }

  return NextResponse.json({ success: true, version: TERMS_VERSION });
}
