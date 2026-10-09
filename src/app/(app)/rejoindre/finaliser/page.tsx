import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNextPath } from "@/lib/utils";
import FinaliserClient from "./FinaliserClient";

export const metadata: Metadata = {
  title: "Finaliser mon profil | Unkast",
  robots: { index: false, follow: false },
};

// Etape de finalisation d'un compte cree par Google (profil minimal, aucun
// metier). auth/callback et le proxy y envoient tout compte connecte sans
// metier ; un compte est finalise des qu'il a au moins un metier.
export default async function FinaliserPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: rawNext } = await searchParams;
  // Chemin interne uniquement, et jamais l'inscription (sans objet ici).
  const candidate = safeNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext, "");
  const next = candidate.startsWith("/rejoindre") ? "" : candidate;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  // Son propre vrai nom : ces colonnes sont fermees au client utilisateur, elles
  // se lisent par le client de confiance, limite a la ligne de l'appelant.
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("full_name, first_name, last_name, stage_name, account_type, profile_roles ( id )")
    .eq("id", user.id)
    .limit(1, { foreignTable: "profile_roles" })
    .single();

  // Utilisateur Auth sans ligne profiles : meme diagnostic que le proxy.
  if (error?.code === "PGRST116") redirect("/compte-introuvable");

  const profile = data as {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    stage_name: string | null;
    account_type: string | null;
    profile_roles: { id: string }[] | null;
  } | null;

  if (profile && (profile.account_type === "recruiter" || (profile.profile_roles ?? []).length > 0)) {
    redirect(next || "/feed");
  }

  // Compte Google : seul full_name est rempli. Premier mot = prenom, le reste = nom.
  const [firstWord = "", ...rest] = (profile?.full_name ?? "").trim().split(/\s+/);

  return (
    <FinaliserClient
      initialFirstName={profile?.first_name || firstWord}
      initialLastName={profile?.last_name || rest.join(" ")}
      initialStageName={profile?.stage_name ?? ""}
      next={next}
    />
  );
}
