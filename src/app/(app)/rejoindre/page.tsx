import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RejoindreClient from "./RejoindreClient";

export const metadata: Metadata = {
  title: "Rejoindre Unkast — Créer mon profil",
  description:
    "Créez votre profil sur Unkast et faites-vous découvrir à travers vos réalisations.",
  openGraph: {
    title: "Rejoindre Unkast",
    description:
      "Créez votre profil sur Unkast et faites-vous découvrir à travers vos réalisations.",
    locale: "fr_FR",
  },
};

// L'inscription classique cree un compte : elle n'est jamais montree a une
// personne deja connectee. Un compte sans metier est deja renvoye vers
// /rejoindre/finaliser par le proxy ; les autres vont au feed.
export default async function RejoindrePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/feed");
  return <RejoindreClient />;
}
