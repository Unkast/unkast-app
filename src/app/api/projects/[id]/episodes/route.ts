import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { SERIES_CATEGORY } from "@/lib/constants";
import { extractPlaylistId } from "@/lib/utils";
import { fetchPlaylistMeta, playlistRefusal } from "@/lib/oembed";
import { checkRateLimit } from "@/lib/rate-limit";

// Episodes d'une serie (projects.episodes, projects.episode_count). Ils sont figes
// a la publication ; un gestionnaire (Responsable ou co-gestionnaire) les relit
// ici quand la playlist a change. Aucune nouvelle validation admin, rien dans
// « modifies recemment », et l'image du film n'est pas touchee.
//
// Les deux colonnes sont hors du GRANT UPDATE : elles ne s'ecrivent qu'avec le
// service role, apres controle du gestionnaire.

type Params = { params: Promise<{ id: string }> };

// POST: actualiser les episodes depuis la playlist
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { data: isManager, error } = await supabase.rpc("is_project_manager", { p_project_id: id });
  if (error) {
    // 22P02 : identifiant qui n'est pas un uuid.
    if (error.code === "22P02") return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    console.error("[projects/episodes] controle du gestionnaire:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  if (!isManager) {
    return NextResponse.json({ error: "Réservé aux gestionnaires du film." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: project } = await admin.from("projects").select("category, video_url").eq("id", id).maybeSingle();
  const playlistId = project?.category === SERIES_CATEGORY ? extractPlaylistId(project.video_url) : null;
  if (!playlistId) {
    return NextResponse.json({ error: "Ce film n'est pas une série." }, { status: 400 });
  }

  // Quota de l'API YouTube : 10 actualisations par heure et par serie.
  if (!(await checkRateLimit(`episodes:${id}`, 10, 3600))) {
    return NextResponse.json({ error: "Trop d'actualisations. Réessaie dans une heure." }, { status: 429 });
  }

  const playlist = await fetchPlaylistMeta(playlistId);
  if (!playlist.ok) {
    const { status, ...refusal } = playlistRefusal(playlist);
    return NextResponse.json(refusal, { status });
  }

  const { error: updateError } = await admin
    .from("projects")
    .update({ episode_count: playlist.episodes.length, episodes: playlist.episodes })
    .eq("id", id);
  if (updateError) {
    console.error("[projects/episodes] mise a jour:", updateError);
    return NextResponse.json({ error: "Erreur lors de la mise à jour des épisodes." }, { status: 500 });
  }

  return NextResponse.json({ success: true, episode_count: playlist.episodes.length });
}
