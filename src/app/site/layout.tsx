import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif } from "next/font/google";
import { MARKETING_URL } from "@/lib/site";

// Polices de la page de vente seulement. JetBrains Mono est deja chargee par le
// layout racine (--font-jetbrains-mono) ; l'app garde DM Sans.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const title = "Unkast : découvre l'œuvre, trouve le talent";
const description =
  "La plateforme où les jeunes talents du cinéma et de l'audiovisuel se font repérer par leurs films. Profil gratuit, films validés à la main.";

// Servie sur unkast.com (reecriture de / vers /site dans next.config.ts). L'adresse
// canonique evite que app.unkast.com/site soit indexee en double.
export const metadata: Metadata = {
  metadataBase: new URL(MARKETING_URL),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", siteName: "Unkast", type: "website", locale: "fr_FR" },
  twitter: { card: "summary", title, description },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${interTight.variable} ${instrumentSerif.variable}`}>{children}</div>;
}
