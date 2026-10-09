import type { Metadata } from "next";
import { adminNext } from "@/lib/adminSession";
import AdminLoginClient from "./AdminLoginClient";

export const metadata: Metadata = { title: "Connexion admin — Unkast", robots: { index: false } };

// Connexion du compte admin : email + mot de passe uniquement (pas de Google), puis
// double authentification sur /admin/mfa. Le proxy laisse cette page ouverte.
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <AdminLoginClient next={adminNext(Array.isArray(next) ? next[0] : next)} />;
}
