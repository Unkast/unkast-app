import Link from "next/link";

// Ligne « Déjà membre ? Se connecter », posée sous chaque invitation à créer un compte.
export default function AlreadyMember({ href = "/connexion", className = "" }: { href?: string; className?: string }) {
  return (
    <p className={`text-xs text-text-secondary ${className}`}>
      Déjà membre ?{" "}
      <Link href={href} className="font-semibold text-text-primary underline underline-offset-2 hover:text-lime">
        Se connecter
      </Link>
    </p>
  );
}
