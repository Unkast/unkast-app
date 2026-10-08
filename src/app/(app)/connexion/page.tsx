import type { Metadata } from "next";
import ConnexionClient from "./ConnexionClient";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Connexion — Unkast",
  description: "Connecte-toi a ton compte Unkast.",
};

// ?next=/chemin : page ou revenir apres la connexion (ex. un film reserve aux
// membres). Valide ici, cote serveur : seul un chemin interne est accepte.
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const raw = Array.isArray(next) ? next[0] : next;
  return <ConnexionClient next={raw ? safeNextPath(raw, "") || undefined : undefined} />;
}
