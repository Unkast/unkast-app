import type { Metadata } from "next";

// Page privee ou technique : jamais indexee. La page est un composant client, qui ne
// peut pas declarer ses metadonnees, d'ou ce layout.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
