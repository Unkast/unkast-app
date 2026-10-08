"use client";

import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";

// Retour après annulation du Checkout (aucun paiement effectué).
export default function ProCancelPage() {
  return (
    <EnterList className="mx-auto w-full max-w-[460px] px-4 py-12 lg:py-20">
      <EnterItem>
        <GlassCard radius="panel" className="px-5 py-8 text-center lg:px-8 lg:py-10">
          <span aria-hidden="true" className="mx-auto mb-5 flex size-14 items-center justify-center rounded-pill border border-white/10 bg-white/5 text-text-secondary">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </span>
          <h1 className="text-sheen mb-3 text-[30px] font-bold lg:text-[36px]">Paiement annulé</h1>
          <p className="mb-7 text-sm leading-relaxed text-text-secondary">
            Aucun montant n&apos;a été débité. Tu peux réessayer quand tu veux.
          </p>
          <Button href="/pro" variant="glass" size="lg" className="max-sm:w-full">
            Revenir à Unkast Pro
          </Button>
        </GlassCard>
      </EnterItem>
    </EnterList>
  );
}
