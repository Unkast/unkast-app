import type { SupabaseClient } from "@supabase/supabase-js";

// Cas douteux du detecteur de coordonnees (lib/contact-detector.ts) : le texte est
// enregistre, puis signale a l'admin dans l'onglet Signalements. Signalement
// automatique : motif 'contact_info', sans auteur (reporter_id NULL = systeme).
// A appeler avec le client service role. Ne bloque jamais l'action de
// l'utilisateur : une erreur est seulement journalisee.
export async function flagContactInfo(
  admin: SupabaseClient,
  targetType: "profile" | "project" | "message" | "career_entry",
  targetId: string,
  reason: string | undefined,
  excerpt: string
): Promise<void> {
  try {
    // Un seul signalement automatique en attente par cible.
    const { count } = await admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("reason", "contact_info")
      .eq("status", "pending");
    if ((count ?? 0) > 0) return;

    const { error } = await admin.from("reports").insert({
      reporter_id: null,
      target_type: targetType,
      target_id: targetId,
      reason: "contact_info",
      description: `Detection automatique (${reason ?? "indice"}) : ${excerpt.slice(0, 300)}`,
    });
    if (error) console.error("[contact-flag] signalement non enregistre:", error.message);
  } catch (e) {
    console.error("[contact-flag] signalement non enregistre:", e);
  }
}
