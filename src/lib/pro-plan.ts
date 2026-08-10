import type { SupabaseClient } from "@supabase/supabase-js";

// Pro offert par l'admin, INDEPENDANT de l'abonnement Stripe (chantier grants,
// migration 20260810_pro_grants.sql). Deux natures, chacune avec sa propre
// regle d'echeance imposee en base par le CHECK profiles_pro_grant_expiry_check :
//   - launch : cadeau de lancement, echeance OBLIGATOIRE (defaut 1 an,
//              pose par l'appelant — pas de valeur par defaut ici).
//   - vip    : choix explicite de l'admin, echeance LIBRE (null = à vie,
//              une date reste possible pour une duree longue determinee).
//
// ⚠️ Un troisieme type, 'recruiter' (lie au statut recruteur approuve, jamais
// d'echeance), a existe du 2026-08-10 (creation, migration 20260810_pro_grants.sql)
// au meme jour (retrait, nouveau modele economique — approve_recruiter ne donne
// plus le Pro). Le stock (1 profil) a ete purge et le CHECK Postgres resserre
// par 20260810_pro_grants_type_cleanup.sql : aucune ligne ne peut plus porter
// cette valeur. Ne pas le reintroduire ici sans repasser par une migration.
export const PRO_GRANT_TYPES = ["launch", "vip"] as const;
export type ProGrantType = (typeof PRO_GRANT_TYPES)[number];

export function isProGrantType(value: unknown): value is ProGrantType {
  return typeof value === "string" && (PRO_GRANT_TYPES as readonly string[]).includes(value);
}

// Natures posables a la main par un admin via l'action grant_pro. Identique a
// PRO_GRANT_TYPES depuis le retrait de 'recruiter' (qui etait le seul type
// exclu — il ne naissait jamais d'un geste admin direct). Conserve comme alias
// distinct pour ne pas re-toucher les imports existants (api/admin/route.ts).
export const ADMIN_GRANTABLE_TYPES: readonly ProGrantType[] = PRO_GRANT_TYPES;

// Valide la regle d'echeance AVANT d'ecrire, pour ne jamais laisser le CHECK
// Postgres (profiles_pro_grant_expiry_check) renvoyer une erreur 500 brute a
// l'appelant admin : mêmes règles que le CHECK, dupliquées côté TS pour un
// message clair. Retourne un message d'erreur, ou null si valide.
export function validateGrantExpiry(type: ProGrantType, expiresAt: string | null): string | null {
  if (type === "launch" && !expiresAt) {
    return "Un Pro de lancement doit avoir une échéance.";
  }
  return null;
}

// Miroir cote TS de la regle de validite appliquee par la RPC recompute_plan
// (SQL) : un grant est valide si sa nature est posee ET (aucune echeance OU
// echeance pas encore atteinte). Duplique volontairement la logique SQL pour
// l'AFFICHAGE (badge admin, page /pro) — ne decide jamais `plan` : seule la
// RPC recompute_plan ecrit `plan`/`pro_since`, cette fonction ne fait que lire.
export function isGrantValid(type: string | null, expiresAt: string | null): boolean {
  if (!type) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

// Appelle la RPC recompute_plan (SECURITY DEFINER, service_role uniquement —
// voir supabase/migrations/20260810_pro_grants.sql). Seule fonction autorisee
// a ecrire `plan`/`pro_since` depuis ce commit : ni le webhook ni les actions
// admin ne les touchent plus directement. La RPC lit l'etat courant (Stripe +
// grant) de la ligne `profiles` visee et applique : plan='pro' <=> abonnement
// Stripe actif OU grant offert valide.
//
// Type du parametre `admin` : SupabaseClient sans generique explicite, pour
// matcher exactement le type renvoye par createAdminClient() (lib/supabase/
// admin.ts), qui n'utilise pas non plus de generique Database.
export async function recomputePlan(admin: SupabaseClient, profileId: string): Promise<{ error: { message: string } | null }> {
  const { error } = await admin.rpc("recompute_plan", { p_profile_id: profileId });
  return { error };
}
