import type { Metadata } from "next";
import MotDePasseOublieClient from "./MotDePasseOublieClient";

export const metadata: Metadata = {
  title: "Mot de passe oublié — Unkast",
  robots: { index: false, follow: false },
};

export default function MotDePasseOubliePage() {
  return <MotDePasseOublieClient />;
}
