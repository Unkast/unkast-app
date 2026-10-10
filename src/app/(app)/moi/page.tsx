import type { Metadata } from "next";
import MoiClient from "./MoiClient";

export const metadata: Metadata = { title: "Mon profil — Unkast", robots: { index: false, follow: false } };

export default function MoiPage() {
  return <MoiClient />;
}
