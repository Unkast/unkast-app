// -----------------------------------------------------------------------------
// Detecteur unique de coordonnees (anti-arnaque : le premier contact passe par Unkast)
// -----------------------------------------------------------------------------
// Utilise par le Parcours, la bio, la description des films et les 3 premiers
// messages d'une conversation. Fonction pure, sans dependance : utilisable cote
// serveur comme cote client.
//
//   obvious  : coordonnee evidente (email, lien, domaine, numero reconstitue).
//              Le texte est refuse.
//   doubtful : indice isole (un mot d'evitement, un debut de numero ecrit en
//              lettres). Le texte est enregistre et signale a l'admin.
//   none     : rien. « Douze hommes en colere » reste « none ».
//
// Le CHECK career_text_ok (migration 20261008_film_management.sql) est le dernier
// rempart en base pour le Parcours ; ce detecteur est plus fin et passe avant.

export type ContactLevel = "none" | "obvious" | "doubtful";
export interface ContactVerdict {
  level: ContactLevel;
  /** Ce qui a declenche le verdict (pour le signalement admin). */
  reason?: string;
}

const UNITS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
};
const TENS: Record<string, number> = {
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};

const TLD = "(?:com|fr|net|org|io|eu|be|ch|ca|tv|me|co)";
const PROVIDER = "(?:gmail|hotmail|outlook|icloud|yahoo)";

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type Token = { digits: string; fromWord: boolean };

// Lit un nombre ecrit en lettres (0 a 99) a partir de words[i].
// Renvoie sa valeur et le nombre de mots consommes, ou null.
function readNumber(words: string[], i: number): { value: number; used: number } | null {
  const w = words[i];
  const next = words[i + 1];
  const next2 = words[i + 2];

  // quatre-vingt(s), quatre-vingt-un ... quatre-vingt-dix-neuf
  if (w === "quatre" && (next === "vingt" || next === "vingts")) {
    if (next2 === "dix" && words[i + 3] !== undefined && UNITS[words[i + 3]] >= 7 && UNITS[words[i + 3]] <= 9) {
      return { value: 90 + UNITS[words[i + 3]], used: 4 };
    }
    if (next2 !== undefined && UNITS[next2] >= 1 && UNITS[next2] <= 16) {
      return { value: 80 + UNITS[next2], used: 3 };
    }
    return { value: 80, used: 2 };
  }

  if (w in TENS) {
    const base = TENS[w];
    let j = i + 1;
    if (words[j] === "et") j++;
    const after = words[j];
    // soixante-dix ... soixante-dix-neuf
    if (base === 60 && after === "dix" && words[j + 1] !== undefined && UNITS[words[j + 1]] >= 7 && UNITS[words[j + 1]] <= 9) {
      return { value: 70 + UNITS[words[j + 1]], used: j + 2 - i };
    }
    if (base === 60 && after !== undefined && UNITS[after] >= 10 && UNITS[after] <= 16) {
      return { value: 60 + UNITS[after], used: j + 1 - i };
    }
    if (after !== undefined && UNITS[after] >= 1 && UNITS[after] <= 9) {
      return { value: base + UNITS[after], used: j + 1 - i };
    }
    return { value: base, used: 1 };
  }

  if (w === "dix" && next !== undefined && UNITS[next] >= 7 && UNITS[next] <= 9) {
    return { value: 10 + UNITS[next], used: 2 };
  }
  if (w in UNITS) return { value: UNITS[w], used: 1 };
  return null;
}

// Decoupe le texte en suites de jetons numeriques consecutifs (chiffres ou nombres
// en lettres), separes uniquement par des espaces, points, virgules, tirets ou barres.
function numericRuns(norm: string): Token[][] {
  const words = norm.split(/[\s.,\-/_()]+/).filter(Boolean);
  const runs: Token[][] = [];
  let current: Token[] = [];
  const flush = () => { if (current.length) runs.push(current); current = []; };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const m = /^\+?(\d+)$/.exec(w);
    if (m) { current.push({ digits: m[1], fromWord: false }); continue; }
    const n = readNumber(words, i);
    if (n) {
      current.push({ digits: String(n.value), fromWord: true });
      i += n.used - 1;
      continue;
    }
    flush();
  }
  flush();
  return runs;
}

// Annee plausible (1900 a 2100) : « 2019-2021 » ou « 2019/2021 » ne sont pas un numero.
const isYear = (d: string) => /^(19\d{2}|20\d{2}|2100)$/.test(d);

export function detectContact(text: string | null | undefined): ContactVerdict {
  if (!text) return { level: "none" };
  const norm = normalize(text);

  // ---- Evident : email, lien, domaine -------------------------------------
  if (/[\w.+-]+@[\w-]+/.test(norm) || /@\w{2,}/.test(norm)) return { level: "obvious", reason: "arobase" };
  if (/https?:\/\/|www\./.test(norm)) return { level: "obvious", reason: "lien" };
  if (new RegExp(`[\\w-]\\.${TLD}\\b`).test(norm)) return { level: "obvious", reason: "domaine" };
  if (new RegExp(`\\bpoint\\s*${TLD}\\b`).test(norm)) return { level: "obvious", reason: "domaine ecrit" };

  // ---- Numero de telephone, meme melange (« 06 douze 34 56 78 ») -----------
  let doubtfulNumber = false;
  for (const run of numericRuns(norm)) {
    const tokens = run;
    const digits = tokens.map((t) => t.digits).join("");
    const hasWord = tokens.some((t) => t.fromWord);
    // Deux annees accolees (« 2019-2021 ») ne sont pas un numero.
    const onlyYears = tokens.every((t) => !t.fromWord && isYear(t.digits));
    if (digits.length >= 8 && !onlyYears) return { level: "obvious", reason: "numero" };
    // Debut de numero en partie ecrit en lettres : douteux.
    if (hasWord && tokens.length >= 3 && digits.length >= 5) doubtfulNumber = true;
  }

  // ---- Mots d'evitement ----------------------------------------------------
  const signals: string[] = [];
  if (/\barobase\b/.test(norm)) signals.push("arobase");
  // « at » ne compte que suivi d'un fournisseur ou d'un domaine (« jean at gmail »).
  if (new RegExp(`\\bat\\s+(?:${PROVIDER}\\b|[\\w-]+\\s*(?:\\.|point|dot)\\s*${TLD}\\b)`).test(norm)) signals.push("at");
  if (new RegExp(`\\b${PROVIDER}\\b`).test(norm)) signals.push("messagerie");
  if (/\b(?:insta|instagram|snap|snapchat|whatsapp|whats app|telegram)\b/.test(norm)) signals.push("reseau");

  if (signals.length >= 2) return { level: "obvious", reason: signals.join(" + ") };
  if (signals.length === 1) return { level: "doubtful", reason: signals[0] };
  if (doubtfulNumber) return { level: "doubtful", reason: "nombres en lettres" };
  return { level: "none" };
}

/** Verdict le plus grave sur plusieurs champs d'un meme formulaire. */
export function detectContactIn(...texts: (string | null | undefined)[]): ContactVerdict {
  let worst: ContactVerdict = { level: "none" };
  for (const t of texts) {
    const v = detectContact(t);
    if (v.level === "obvious") return v;
    if (v.level === "doubtful") worst = v;
  }
  return worst;
}
