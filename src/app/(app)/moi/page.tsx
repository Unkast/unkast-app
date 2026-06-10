import type { Metadata } from "next";
import MoiClient from "./MoiClient";

export const metadata: Metadata = { title: "Mon profil — Unkast" };

export default function MoiPage() {
  return <MoiClient />;
}
