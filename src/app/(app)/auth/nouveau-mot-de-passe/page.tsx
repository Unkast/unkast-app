import type { Metadata } from "next";
import NouveauMotDePasseClient from "./NouveauMotDePasseClient";

// Sous /auth : la redirection vers la finalisation d'inscription ne s'applique pas
// (FINALIZE_EXEMPT, lib/supabase/middleware.ts).
export const metadata: Metadata = {
  title: "Nouveau mot de passe — Unkast",
  robots: { index: false, follow: false },
};

export default async function NouveauMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[] }>;
}) {
  const { token_hash } = await searchParams;
  const tokenHash = Array.isArray(token_hash) ? token_hash[0] : token_hash;
  return <NouveauMotDePasseClient tokenHash={tokenHash ?? null} />;
}
