import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/adminGuard";
import { adminNext } from "@/lib/adminSession";
import AdminMfaClient from "./AdminMfaClient";

export const metadata: Metadata = { title: "Double authentification — Unkast", robots: { index: false } };

// Second facteur du compte admin. Reservee a un compte admin deja connecte par mot
// de passe : meme controle que le proxy, refait ici (le proxy ne voit pas le prefetch).
export default async function AdminMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = adminNext(Array.isArray(next) ? next[0] : next);
  const access = await getAdminAccess();
  if (!access.isAdmin) redirect(access.userId ? "/feed" : "/admin/connexion");
  if (!access.password) redirect("/admin/connexion");
  if (access.mfa) redirect(target);
  return <AdminMfaClient next={target} />;
}
