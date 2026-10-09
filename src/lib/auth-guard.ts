import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DISPLAY_NAME_COLUMNS, displayNameOf } from "@/lib/profile";

// Garde commun aux routes API sensibles (chantier 3 — moderation).
// Authentifie l'utilisateur ET verifie qu'il n'est PAS suspendu.
//
// La suspension (is_suspended) etait jusque-la appliquee UNIQUEMENT par le
// middleware sur la navigation des pages — les routes /api restaient ouvertes
// (le middleware exclut /api). Ce garde ferme ce trou cote serveur.
//
// Renvoie aussi le profil (plan/account_type/full_name) pour mutualiser les
// lectures deja faites par certaines routes (messages, recruitment).

type Server = Awaited<ReturnType<typeof createClient>>;

export interface ActiveUserProfile {
  id: string;
  is_suspended: boolean | null;
  plan: string | null;
  account_type: string | null;
  full_name: string | null;
  // Nom d'affichage (nom de scene si choisi) : a utiliser pour tout texte vu par
  // quelqu'un d'autre (notification push, email). full_name reste le vrai nom.
  display_name: string;
}

// `email` vient de l'utilisateur Auth (pas de `profiles.contact_email`, qui est un
// champ public editable et sans rapport). Expose parce que getUser() est deja
// appele ici : sans ca, une route qui a besoin de l'email (billing/checkout, pour
// creer le customer Stripe) devrait refaire un aller-retour Auth complet.
export async function getActiveUser(
  supabase: Server
): Promise<
  | { user: { id: string; email: string | null }; profile: ActiveUserProfile; error: null; status: 200 }
  | { user: null; profile: null; error: string; status: 401 | 403 | 503 }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, profile: null, error: "Non authentifie.", status: 401 };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(`id, is_suspended, plan, account_type, full_name, ${DISPLAY_NAME_COLUMNS}`)
    .eq("id", user.id)
    .single();

  // FAIL-CLOSED. Cette lecture est le SEUL controle de suspension du serveur : si
  // elle n'aboutit pas, on ne sait pas si le compte est banni. L'ancienne version
  // ignorait `error` et retombait sur un profil de secours `is_suspended: false`,
  // qui affirmait "non suspendu" au lieu de dire "je n'ai pas pu verifier" — un
  // compte suspendu passait donc pendant toute la duree d'un incident base.
  if (profileError) {
    // PGRST116 = ".single() n'a pas eu exactement une ligne". Le filtre porte sur
    // la cle primaire, donc "plusieurs lignes" est impossible : c'est forcement
    // ZERO ligne, un utilisateur Auth sans ligne `profiles` (orphelin). Etat
    // PERMANENT, pas transitoire : un 503 ferait boucler le client indefiniment.
    // Origine connue : compensation ratee dans api/signup (cf. le log
    // "compensation deleteUser echouee"), ou suppression manuelle de la ligne.
    // Un compte Google se repare seul au re-login (auth/callback recree le
    // profil) ; un compte email/mot de passe n'a aucun chemin de reparation
    // automatique, la ligne doit etre recreee a la main.
    if (profileError.code === "PGRST116") {
      console.error(
        `[auth-guard] Profil introuvable pour l'utilisateur Auth ${user.id} — ligne profiles absente (orphelin). Ecriture refusee.`
      );
      return {
        user: null,
        profile: null,
        error: "Profil introuvable. Contacte le support.",
        status: 403,
      };
    }

    // Tout le reste est TRANSITOIRE : reseau, timeout, 5xx PostgREST, pool
    // sature, cle service role invalide. 503 et message neutre — surtout pas
    // "Compte suspendu.", qui mentirait sur la cause et enverrait un utilisateur
    // legitime vers /suspended pendant un incident.
    console.error(
      `[auth-guard] Verification de suspension impossible pour ${user.id} :`,
      profileError
    );
    return {
      user: null,
      profile: null,
      error: "Verification impossible, reessaie.",
      status: 503,
    };
  }

  if (profile.is_suspended) {
    return { user: null, profile: null, error: "Compte suspendu.", status: 403 };
  }

  // `profile` est garanti non-null ici (toute erreur est sortie plus haut) : plus
  // aucun profil de secours n'est fabrique.
  return {
    user: { id: user.id, email: user.email ?? null },
    profile: {
      id: profile.id,
      is_suspended: profile.is_suspended,
      plan: profile.plan,
      account_type: profile.account_type,
      full_name: profile.full_name,
      display_name: displayNameOf(profile) as string,
    },
    error: null,
    status: 200,
  };
}
