import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Note la derniere modification d'un film approuve, pour la liste « modifies
// recemment » de l'admin. Le declencheur track_project_edit le fait pour les
// ecritures d'un client (il lit auth.uid()) ; une ecriture en service role n'a pas
// d'appelant, d'ou cet equivalent a appeler depuis la route. Jamais bloquant.
export async function markProjectEdited(admin: SupabaseClient, projectId: string, userId: string): Promise<void> {
  try {
    const { data: project } = await admin.from("projects").select("status").eq("id", projectId).maybeSingle();
    if (project?.status !== "approved") return;
    await admin
      .from("project_moderation")
      .upsert({ project_id: projectId, edited_at: new Date().toISOString(), edited_by: userId }, { onConflict: "project_id" });
  } catch (error) {
    console.error("[project-edit] suivi de modification impossible :", error);
  }
}
