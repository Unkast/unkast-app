import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Clavier virtuel : il redimensionne la mise en page (donc 100dvh), pas seulement la
  // zone visible — la barre de saisie reste au-dessus du clavier.
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  // Base des adresses absolues (images de partage).
  metadataBase: new URL(SITE_URL),
  title: "Unkast — Découvre l'œuvre. Trouve le talent.",
  description:
    "La plateforme où les professionnels du cinéma et de l'audiovisuel français se font découvrir à travers leurs réalisations.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Unkast",
  },
  other: {
    "theme-color": "#0d0d0d",
  },
  openGraph: {
    title: "Unkast — Découvre l'œuvre. Trouve le talent.",
    description:
      "La plateforme où les professionnels du cinéma et de l'audiovisuel français se font découvrir à travers leurs réalisations.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full font-sans bg-canvas-halos">
        {/* Android : classe .lite sur <html> avant le premier rendu (verre opaque, sans
            backdrop-filter, voir globals.css). Layout serveur : le script s'execute toujours. */}
        <script dangerouslySetInnerHTML={{ __html: `if(/Android/i.test(navigator.userAgent))document.documentElement.classList.add("lite")` }} />
        {children}
      </body>
    </html>
  );
}
