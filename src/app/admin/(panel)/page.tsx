import type { Metadata } from "next";
import AdminClient from "./AdminClient";

export const metadata: Metadata = { title: "Admin — Unkast", robots: { index: false, follow: false } };

// ?tab=films : onglet ouvert a l'arrivee (lien des emails d'alerte). La valeur
// est validee par AdminClient, qui connait la liste des onglets.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  return <AdminClient initialTab={Array.isArray(tab) ? tab[0] : tab} />;
}
