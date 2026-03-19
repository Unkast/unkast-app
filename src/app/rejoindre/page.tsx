import type { Metadata } from "next";
import RejoindreClient from "./RejoindreClient";

export const metadata: Metadata = {
  title: "Rejoindre Unkast — Creer mon profil",
  description:
    "Creez votre profil sur Unkast et faites-vous decouvrir a travers vos realisations.",
  openGraph: {
    title: "Rejoindre Unkast",
    description:
      "Creez votre profil sur Unkast et faites-vous decouvrir a travers vos realisations.",
    locale: "fr_FR",
  },
};

export default function RejoindrePage() {
  return <RejoindreClient />;
}
