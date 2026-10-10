import { redirect } from "next/navigation";
import { getAdminId } from "@/lib/adminGuard";
import ViewAs from "./ViewAs";

// Espace admin hors du groupe (app) : pas d'AppShell (ni sidebar, ni tab bar).
// Double garde : le proxy redirige deja /admin (non connecte -> /admin/connexion,
// non admin -> /feed, sans double authentification -> /admin/mfa), mais son matcher
// exclut le prefetch — ce layout serveur est le mur infranchissable, via le MEME
// helper que /api/admin (getAdminId : is_admin + mot de passe + MFA).
// Groupe (panel) : /admin/connexion et /admin/mfa sont hors de ce layout.
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminId = await getAdminId();
  if (!adminId) redirect("/admin/connexion");

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          // Zone sure : dans l'app Android la page passe sous la barre d'etat.
          padding: "env(safe-area-inset-top, 0px) 16px 0",
          minHeight: "calc(52px + env(safe-area-inset-top, 0px))",
          background: "rgba(13,13,13,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>
          Unkast<span style={{ color: "#C8FF00" }}>.</span>{" "}
          <span style={{ fontWeight: 400, color: "#868686" }}>Admin</span>
        </span>
        <ViewAs />
      </header>
      {children}
    </div>
  );
}
