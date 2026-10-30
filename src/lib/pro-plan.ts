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

// Fin du Pro offert pendant la beta (CGU section 9 : « offerte jusqu'au 1er
// fevrier 2027 »). Fin de journee, heure de Paris. Toutes les dates d'echeance
// s'affichent en heure de Paris (formatDateParis, lib/utils.ts) : sans cela un
// navigateur a Dubai (UTC+4) lisait « 2 fevrier ».
export const LAUNCH_PRO_UNTIL = "2027-02-01T23:59:59+01:00";

// L'offre de lancement est-elle encore ouverte ? (ecran de bienvenue : seulement
// si l'inscription a lieu avant la fin de l'offre.)
export function isLaunchOfferOpen(): boolean {
  return Date.now() < new Date(LAUNCH_PRO_UNTIL).getTime();
}

// « Membre fondateur » : compte cree jusqu'a la fin de l'offre de lancement.
// Derive de profiles.created_at, sans colonne ni migration : un membre ne peut pas
// modifier sa date de creation (pas de GRANT UPDATE dessus). Le badge reste apres
// la fin du Pro offert.
export function isFoundingMember(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  return !Number.isNaN(t) && t <= new Date(LAUNCH_PRO_UNTIL).getTime();
}

// Jours calendaires restants, en heure de Paris : 0 = dernier jour (l'echeance
// tombe aujourd'hui), jamais negatif.
export function launchProDaysLeft(expiresAt: string, now: Date = new Date()): number {
  const parisDay = (d: Date) => new Date(d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })).getTime();
  return Math.max(0, Math.round((parisDay(new Date(expiresAt)) - parisDay(now)) / 86_400_000));
}

// Pro de lancement pose a l'inscription (email et Google), sans admin
// (granted_by NULL). Ne fait rien une fois la date passee. Jamais bloquant :
// en cas d'echec, l'erreur est loguee et l'inscription continue.
export async function grantLaunchPro(admin: SupabaseClient, profileId: string): Promise<void> {
  if (Date.now() >= new Date(LAUNCH_PRO_UNTIL).getTime()) return;

  const { error } = await admin.from("profiles").update({
    pro_grant_type: "launch",
    pro_grant_expires_at: LAUNCH_PRO_UNTIL,
    pro_grant_granted_by: null,
    pro_grant_granted_at: new Date().toISOString(),
  }).eq("id", profileId);
  const failure = error ?? (await recomputePlan(admin, profileId)).error;
  if (failure) console.error(`[pro-plan] Pro de lancement non attribué à ${profileId} :`, failure);
}
