"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";

// Page de retour après un paiement Checkout réussi. PUREMENT informative :
// l'activation du Pro est faite par le webhook, pas par cette page.
export default function ProSuccessPage() {
  const router = useRouter();

  // Le plan est lu au montage des pages via le profil ; on rafraîchit après un
  // court délai pour laisser le webhook poser plan='pro'.
  useEffect(() => {
    const t = setTimeout(() => router.refresh(), 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <EnterList className="mx-auto w-full max-w-[460px] px-4 py-12 lg:py-20">
      <EnterItem>
        <GlassCard strong radius="panel" className="px-5 py-8 text-center lg:px-8 lg:py-10">
          <span aria-hidden="true" className="mx-auto mb-5 flex size-14 items-center justify-center rounded-pill border border-green-500/30 bg-green-500/10 text-green-500 shadow-[0_0_28px_rgba(34,197,94,0.25)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          </span>
          <h1 className="text-sheen mb-3 text-[30px] font-bold lg:text-[36px]">Paiement reçu</h1>
          <p className="mb-7 text-sm leading-relaxed text-text-secondary">
            Ton abonnement Unkast Pro est en cours d&apos;activation (quelques secondes). Tu peux déjà retourner sur ton espace.
          </p>
          <Button href="/moi" size="lg" className="max-sm:w-full">
            Retour à mon espace
          </Button>
        </GlassCard>
      </EnterItem>
    </EnterList>
  );
}
