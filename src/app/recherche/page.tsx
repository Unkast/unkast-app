import type { Metadata } from "next";
import RechercheClient from "./RechercheClient";

export const metadata: Metadata = {
  title: "Recherche — Unkast",
  description:
    "Recherchez des talents et des projets dans le cinema et l'audiovisuel francais.",
  openGraph: {
    title: "Recherche — Unkast",
    description:
      "Recherchez des talents et des projets dans le cinema et l'audiovisuel francais.",
    locale: "fr_FR",
  },
};

export default function RecherchePage() {
  return <RechercheClient />;
}
