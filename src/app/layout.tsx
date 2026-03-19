import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import SplashScreen from "@/components/SplashScreen";

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
};

export const metadata: Metadata = {
  title: "Unkast — Decouvre l'oeuvre. Trouve le talent.",
  description:
    "La plateforme ou les professionnels du cinema et de l'audiovisuel francais se font decouvrir a travers leurs realisations.",
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
  openGraph: {
    title: "Unkast — Decouvre l'oeuvre. Trouve le talent.",
    description:
      "La plateforme ou les professionnels du cinema et de l'audiovisuel francais se font decouvrir a travers leurs realisations.",
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
      className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full font-sans">
        <SplashScreen>
          <AppShell>{children}</AppShell>
        </SplashScreen>
      </body>
    </html>
  );
}
