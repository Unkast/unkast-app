import { extractVideoKey } from "@/lib/utils";

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
  const meta = await fetchVideoMeta(videoUrl);
  return meta.ok ? meta.thumbnail : null;
}
