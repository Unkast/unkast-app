import { extractVideoKey } from "@/lib/utils";

// Titre et nom de la chaine d'une video YouTube / Vimeo, lus via oEmbed a la
// soumission d'un film. Affiches a l'admin pendant la validation.
//
//   ok: true              video publique (title / author peuvent manquer)
//   ok: false, "private"  video privee, protegee par mot de passe, supprimee ou
//                         non integrable : la publication est refusee
//
// Erreur transitoire (reseau, 5xx, delai) : on laisse passer sans metadonnees,
// l'admin valide de toute facon le film (ADR 0004 : n'ouvrir que sur erreur
// transitoire). Plateforme non reconnue (video_key null) : aucun controle.

export type VideoMeta =
  | { ok: true; title: string | null; author: string | null }
  | { ok: false; reason: "private" };

export async function fetchVideoMeta(videoUrl: string): Promise<VideoMeta> {
  const key = extractVideoKey(videoUrl);
  if (!key) return { ok: true, title: null, author: null };

  const endpoint = key.startsWith("youtube:")
    ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`
    : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`;

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { ok: false, reason: "private" };
    }
    if (!res.ok) return { ok: true, title: null, author: null };
    const data = (await res.json()) as { title?: unknown; author_name?: unknown };
    return {
      ok: true,
      title: typeof data.title === "string" ? data.title.slice(0, 300) : null,
      author: typeof data.author_name === "string" ? data.author_name.slice(0, 200) : null,
    };
  } catch {
    return { ok: true, title: null, author: null };
  }
}
