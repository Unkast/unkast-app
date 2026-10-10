import { extractVideoKey } from "@/lib/utils";
import type { Episode } from "@/types/database";

// Titre, nom de la chaine et vignette d'une video YouTube / Vimeo, lus via oEmbed
// a la soumission d'un film. Titre et chaine sont affiches a l'admin pendant la
// validation ; la vignette devient l'image du film par defaut (poster_url).
//
//   ok: true              video publique (title / author peuvent manquer)
//   ok: false, "private"  video privee, protegee par mot de passe, supprimee ou
//                         non integrable : la publication est refusee
//
// Erreur transitoire (reseau, 5xx, delai) : on laisse passer sans metadonnees,
// l'admin valide de toute facon le film (ADR 0004 : n'ouvrir que sur erreur
// transitoire). Plateforme non reconnue (video_key null) : aucun controle.

const PLAYLIST_KEY = "youtube-playlist:";

export type VideoMeta =
  | { ok: true; title: string | null; author: string | null; thumbnail: string | null; duration: number | null }
  | { ok: false; reason: "private" };

export async function fetchVideoMeta(videoUrl: string): Promise<VideoMeta> {
  const key = extractVideoKey(videoUrl);
  if (!key) return { ok: true, title: null, author: null, thumbnail: null, duration: null };

  // Vimeo : width=1280 demande la vignette en grande taille.
  const endpoint = key.startsWith("youtube:")
    ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`
    : `https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(videoUrl)}`;

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { ok: false, reason: "private" };
    }
    if (!res.ok) return { ok: true, title: null, author: null, thumbnail: null, duration: null };
    const data = (await res.json()) as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown; duration?: unknown };
    const fallback = typeof data.thumbnail_url === "string" && data.thumbnail_url.startsWith("https://")
      ? data.thumbnail_url
      : null;
    return {
      ok: true,
      title: typeof data.title === "string" ? data.title.slice(0, 300) : null,
      author: typeof data.author_name === "string" ? data.author_name.slice(0, 200) : null,
      thumbnail: key.startsWith("youtube:") ? await bestYoutubeThumbnail(key.slice(8), fallback) : fallback,
      // Duree en secondes : Vimeo la donne, YouTube non.
      duration: typeof data.duration === "number" && data.duration > 0 ? Math.round(data.duration) : null,
    };
  } catch {
    return { ok: true, title: null, author: null, thumbnail: null, duration: null };
  }
}

// YouTube : oEmbed ne donne que hqdefault (480 x 360, bandes noires en 16:9).
// maxresdefault (1280 x 720) puis sddefault existent selon la video : on prend
// la premiere qui repond, sinon la vignette d'oEmbed.
async function bestYoutubeThumbnail(id: string, fallback: string | null): Promise<string | null> {
  for (const name of ["maxresdefault", "sddefault"]) {
    const url = `https://i.ytimg.com/vi/${id}/${name}.jpg`;
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000), cache: "no-store" });
      if (res.ok) return url;
    } catch {
      // delai ou reseau : on essaie la suivante
    }
  }
  return fallback;
}

/** Vignette seule, pour remettre l'image de la video (null si introuvable). */
export async function fetchVideoThumbnail(videoUrl: string): Promise<string | null> {
  const key = extractVideoKey(videoUrl);
  if (key?.startsWith(PLAYLIST_KEY)) {
    const playlist = await fetchPlaylistMeta(key.slice(PLAYLIST_KEY.length));
    return playlist.ok ? playlist.thumbnail : null;
  }
  const meta = await fetchVideoMeta(videoUrl);
  return meta.ok ? meta.thumbnail : null;
}

// -----------------------------------------------------------------------------
// Serie : playlist YouTube, lue par l'API YouTube Data v3 (YOUTUBE_API_KEY)
// -----------------------------------------------------------------------------
// oEmbed ne donne ni le nombre d'episodes ni leur liste : il faut l'API.
//
//   ok: true                     titre, chaine, image et episodes lisibles
//   ok: false, "private"         playlist privee, supprimee ou introuvable
//   ok: false, "empty"           aucun episode
//   ok: false, "unreadable"      episodes prives ou supprimes (`positions`, a partir de 1)
//   ok: false, "unavailable"     cle absente, quota, reseau : on ne publie pas une
//                                serie sans ses episodes (pas de passage a l'aveugle)

export type PlaylistMeta =
  | { ok: true; title: string | null; author: string | null; thumbnail: string | null; episodes: Episode[] }
  | { ok: false; reason: "private" | "empty" | "unavailable" }
  | { ok: false; reason: "unreadable"; positions: number[] };

// 4 pages de 50 : une serie de plus de 200 episodes est coupee a 200.
const MAX_EPISODE_PAGES = 4;

type YoutubeThumbnails = Partial<Record<"maxres" | "standard" | "high" | "medium", { url?: string }>>;

async function youtubeApi<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key })}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    // 404 : playlist introuvable ou privee (reponse vide, traitee par l'appelant).
    if (res.status === 404) return { items: [] } as T;
    if (!res.ok) {
      console.error("[oembed] API YouTube:", path, res.status);
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchPlaylistMeta(playlistId: string): Promise<PlaylistMeta> {
  const list = await youtubeApi<{
    items?: { snippet?: { title?: string; channelTitle?: string; thumbnails?: YoutubeThumbnails } }[];
  }>("playlists", { part: "snippet", id: playlistId });
  if (!list) return { ok: false, reason: "unavailable" };
  const snippet = list.items?.[0]?.snippet;
  if (!snippet) return { ok: false, reason: "private" };

  const episodes: Episode[] = [];
  const unreadable: number[] = [];
  let pageToken = "";
  for (let page = 0; page < MAX_EPISODE_PAGES; page++) {
    const items = await youtubeApi<{
      nextPageToken?: string;
      items?: { snippet?: { title?: string; resourceId?: { videoId?: string } }; status?: { privacyStatus?: string } }[];
    }>("playlistItems", { part: "snippet,status", playlistId, maxResults: "50", ...(pageToken && { pageToken }) });
    if (!items) return { ok: false, reason: "unavailable" };
    for (const item of items.items ?? []) {
      const id = item.snippet?.resourceId?.videoId;
      const privacy = item.status?.privacyStatus;
      // Une video privee ou supprimee reste dans la playlist, sans etre lisible.
      if (id && (privacy === "public" || privacy === "unlisted")) {
        episodes.push({ id, title: (item.snippet?.title ?? "").slice(0, 300) });
      } else {
        unreadable.push(episodes.length + unreadable.length + 1);
      }
    }
    pageToken = items.nextPageToken ?? "";
    if (!pageToken) break;
  }

  if (unreadable.length > 0) return { ok: false, reason: "unreadable", positions: unreadable };
  if (episodes.length === 0) return { ok: false, reason: "empty" };

  const t = snippet.thumbnails ?? {};
  const thumbnail = (t.maxres ?? t.standard ?? t.high ?? t.medium)?.url ?? null;
  return {
    ok: true,
    title: typeof snippet.title === "string" ? snippet.title.slice(0, 300) : null,
    author: typeof snippet.channelTitle === "string" ? snippet.channelTitle.slice(0, 200) : null,
    thumbnail: thumbnail?.startsWith("https://") ? thumbnail : null,
    episodes,
  };
}

/** Message a montrer quand une playlist ne peut pas etre publiee ou actualisee. */
export function playlistRefusal(meta: Extract<PlaylistMeta, { ok: false }>): { code: string; error: string; status: number } {
  switch (meta.reason) {
    case "private":
      return { code: "playlist_private", status: 400, error: "Cette playlist est introuvable ou en « Privée ». Passe-la en « Publique » ou « Non répertoriée », puis réessaie." };
    case "empty":
      return { code: "playlist_empty", status: 400, error: "Cette playlist ne contient aucun épisode." };
    case "unreadable": {
      const many = meta.positions.length > 1;
      return {
        code: "episode_private",
        status: 400,
        error: `${many ? "Les épisodes" : "L'épisode"} ${meta.positions.slice(0, 10).join(", ")} de la playlist ${many ? "sont en « Privée » ou supprimés" : "est en « Privée » ou supprimé"} : impossible de ${many ? "les" : "le"} lire sur Unkast. Passe ${many ? "ces vidéos" : "cette vidéo"} en « Non répertoriée » ou « Publique », ou retire-${many ? "les" : "la"} de la playlist, puis réessaie.`,
      };
    }
    default:
      return { code: "playlist_unavailable", status: 503, error: "Impossible de lire la playlist pour le moment. Réessaie dans quelques minutes." };
  }
}
