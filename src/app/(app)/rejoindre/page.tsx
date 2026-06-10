import type { Metadata } from "next";
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

export default function RejoindrePage() {
  return <RejoindreClient />;
}
