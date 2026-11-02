import { redirect } from "next/navigation";
import { getAdminId } from "@/lib/adminGuard";
import ViewAs from "./ViewAs";
import SignOutButton from "./SignOutButton";

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
      {/* Mobile : titre puis « Voir le site comme » sur une ligne en dessous ; bureau : une seule ligne. */}
      <header
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 max-md:pb-2.5 max-md:pt-1"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          // Zone sure : dans l'app Android la page passe sous la barre d'etat.
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: "env(safe-area-inset-top, 0px)",
          minHeight: "calc(52px + env(safe-area-inset-top, 0px))",
          background: "rgba(13,13,13,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span className="order-1" style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>
          Unkast<span style={{ color: "#C8FF00" }}>.</span>{" "}
          <span style={{ fontWeight: 400, color: "#868686" }}>Admin</span>
        </span>
        <SignOutButton className="order-2 max-md:ml-auto md:order-3" />
        <div className="order-3 max-md:w-full md:order-2 md:ml-auto">
          <ViewAs />
        </div>
      </header>
      {children}
    </div>
  );
}
