import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminId } from "@/lib/adminGuard";

// Espace admin hors du groupe (app) : pas d'AppShell (ni sidebar, ni tab bar).
// Double garde : le middleware redirige deja /admin (non connecte -> /connexion,
// non admin -> /feed), mais son matcher exclut le prefetch — ce layout serveur
// est le mur infranchissable, via le MEME helper que /api/admin (getAdminId).
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminId = await getAdminId();
  if (!adminId) redirect("/feed");

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
          padding: "0 16px",
          minHeight: 52,
          background: "rgba(13,13,13,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>
          Unkast<span style={{ color: "#C8FF00" }}>.</span>{" "}
          <span style={{ fontWeight: 400, color: "#555" }}>Admin</span>
        </span>
        <Link href="/feed" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>
          ← Retour à l&apos;app
        </Link>
      </header>
      {children}
    </div>
  );
}
