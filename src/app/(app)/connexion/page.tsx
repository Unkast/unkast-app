import type { Metadata } from "next";
import ConnexionClient from "./ConnexionClient";

export const metadata: Metadata = {
  title: "Connexion — Unkast",
  description: "Connecte-toi a ton compte Unkast.",
};

export default function ConnexionPage() {
  return <ConnexionClient />;
}
