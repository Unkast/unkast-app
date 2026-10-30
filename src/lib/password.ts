// Regle du mot de passe, partagee par les formulaires et les routes serveur
// (/api/signup, /api/auth/update-password) : 8 caracteres au moins, une
// majuscule, une minuscule et un chiffre, aucun espace. Alignee sur le reglage Supabase Auth
// « Lowercase, uppercase letters and digits », minimum 8 : memes classes ASCII
// que Supabase (une lettre accentuee ne compte pas, sinon Supabase refuserait
// un mot de passe que le formulaire accepte).
export const PASSWORD_MIN_LENGTH = 8;

// Aucun espace : espace, espace insecable, tabulation, saut de ligne (\s couvre
// les espaces Unicode). Regle propre a Unkast, Supabase ne l'impose pas : la
// connexion (/connexion) ne la controle pas, un ancien mot de passe avec espace
// reste utilisable.
const hasNoSpace = (pw: string) => !/\s/.test(pw);
// Critere affiche : gris tant que le champ est vide (« pas d'espace » y est vrai par defaut).
export const isPasswordRuleMet = (rule: { test: (pw: string) => boolean; needsInput?: boolean }, pw: string) =>
  rule.test(pw) && !(rule.needsInput && pw.length === 0);
export const PASSWORD_NO_SPACE = "Ton mot de passe ne doit pas contenir d'espace.";

// Criteres affiches sous le champ (chacun passe au vert une fois rempli).
// `missing` : ce qui manque, pour le message d'erreur (absent pour « Pas
// d'espace », qui a son propre message).
export const PASSWORD_RULES: readonly { label: string; missing?: string; needsInput?: boolean; test: (pw: string) => boolean }[] = [
  { label: `${PASSWORD_MIN_LENGTH} caractères minimum`, missing: `au moins ${PASSWORD_MIN_LENGTH} caractères`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { label: "Une majuscule", missing: "une majuscule", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Une minuscule", missing: "une minuscule", test: (pw) => /[a-z]/.test(pw) },
  { label: "Un chiffre", missing: "un chiffre", test: (pw) => /[0-9]/.test(pw) },
  { label: "Pas d'espace", needsInput: true, test: hasNoSpace },
];

// Renvoie le message a afficher (tout ce qui manque, puis l'espace interdit),
// ou null si le mot de passe est valide.
export function passwordError(password: unknown): string | null {
  const pw = typeof password === "string" ? password : "";
  const missing = PASSWORD_RULES.filter((r) => r.missing && !r.test(pw)).map((r) => r.missing as string);
  const messages: string[] = [];
  if (missing.length > 0) {
    const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} et ${missing[missing.length - 1]}`;
    messages.push(`Ton mot de passe doit contenir ${list}.`);
  }
  if (!hasNoSpace(pw)) messages.push(PASSWORD_NO_SPACE);
  return messages.length ? messages.join(" ") : null;
}

export const PASSWORD_MISMATCH = "Les deux mots de passe ne correspondent pas.";

// Refus de Supabase Auth (code weak_password) traduit en francais : jamais le
// message anglais brut. `reasons` vient de l'erreur Supabase (length, characters, pwned).
export function weakPasswordMessage(reasons?: string[]): string {
  if (reasons?.includes("pwned")) {
    return "Ce mot de passe est apparu dans une fuite de données connue. Choisis-en un autre.";
  }
  return `Ce mot de passe n'est pas accepté. Il doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères, une majuscule, une minuscule et un chiffre, sans espace.`;
}
