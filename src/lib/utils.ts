export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Nouvelle adresse de profil (slug) a partir d'un nom d'affichage, avec un
// suffixe aleatoire : rien ne la relie a l'adresse precedente. Sert quand une
// personne passe de son vrai nom a un nom de scene (l'ancienne adresse, qui
// contient son vrai nom, cesse d'exister).
export function newProfileSlug(displayName: string): string {
  return (slugify(displayName) || "profil") + "-" + crypto.randomUUID().slice(0, 6);
}

// -----------------------------------------------------------------------------
// Identifiant canonique d'une vid\u00e9o (anti-vol d'\u0153uvre, chantier 9)
// -----------------------------------------------------------------------------
// Une m\u00eame vid\u00e9o peut avoir plusieurs URLs (youtu.be/ABC, youtube.com/watch?v=ABC,
// /embed/ABC, /shorts/ABC, http/https, param\u00e8tres &t= / &list=\u2026). Pour d\u00e9tecter
// un doublon, on compare un identifiant CANONIQUE "plateforme:id" (ex.
// "youtube:dQw4w9WgXcQ"), jamais l'URL brute.
//
// Renvoie null si la plateforme/l'ID n'est pas reconnu de fa\u00e7on S\u00dbRE \u2014 dans ce cas
// aucune unicit\u00e9 n'est appliqu\u00e9e (on pr\u00e9f\u00e8re ne rien bloquer plut\u00f4t qu'un faux positif).
// Serie : "youtube-playlist:<id>" pour l'adresse d'une playlist (meme regle dans
// extract_video_key, migration 20261023).
// Les deux seules plateformes support\u00e9es par react-player ici : YouTube et Vimeo.
export function extractVideoKey(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  // Host normalis\u00e9 (sans "www." / "m." / "player.") et minuscule.
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|player\.)/, "");

  // --- YouTube : ID = 11 caract\u00e8res [A-Za-z0-9_-] ---
  const ytId = (id: string | null | undefined): string | null => {
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return `youtube:${id}`;
    return null;
  };
  if (host === "youtu.be") {
    // youtu.be/<id>
    return ytId(url.pathname.split("/").filter(Boolean)[0]);
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    // /playlist?list=<id> : une serie, cle "youtube-playlist:<id>"
    if (/^\/+playlist\/?$/.test(url.pathname)) {
      const list = url.searchParams.get("list");
      return list && PLAYLIST_ID.test(list) ? `youtube-playlist:${list}` : null;
    }
    // /watch?v=<id>
    const v = url.searchParams.get("v");
    if (v) return ytId(v);
    // /embed/<id>, /shorts/<id>, /v/<id>, /live/<id>
    const seg = url.pathname.split("/").filter(Boolean);
    if (seg.length >= 2 && ["embed", "shorts", "v", "live"].includes(seg[0])) {
      return ytId(seg[1]);
    }
    return null;
  }

  // --- Vimeo : ID = suite de chiffres ---
  if (host === "vimeo.com") {
    // vimeo.com/<digits>, /channels/x/<digits>, /groups/x/videos/<digits>, /video/<digits>
    const seg = url.pathname.split("/").filter(Boolean);
    const digits = seg.reverse().find((s) => /^\d+$/.test(s));
    if (digits) return `vimeo:${digits}`;
    return null;
  }

  return null;
}

// Identifiant d'une playlist YouTube (PL..., UU..., OLAK5uy_...).
const PLAYLIST_ID = /^[A-Za-z0-9_-]{13,64}$/;

// Playlist d'une serie : identifiant lu dans n'importe quel lien YouTube qui porte
// list= (page de la playlist, ou video ouverte depuis la playlist). null sinon.
export function extractPlaylistId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
    const list = url.searchParams.get("list");
    return (host === "youtube.com" || host === "youtu.be") && list && PLAYLIST_ID.test(list) ? list : null;
  } catch {
    return null;
  }
}

// Adresse canonique d'une playlist : c'est elle qui est enregistree (video_url),
// et extractVideoKey en tire la cle anti-doublon.
export const playlistUrl = (id: string) => `https://www.youtube.com/playlist?list=${id}`;
export const episodeUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

// Adresse de retour apres connexion (parametre ?next=) : uniquement un chemin
// interne. Tout le reste (URL absolue, « //hote », antislash, « @hote » colle a
// l'origine) retombe sur la valeur par defaut : pas de redirection ouverte.
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !/^\/(?![/\\])[^\\\s\x00-\x1f]*$/.test(value)) return fallback;
  return value;
}
