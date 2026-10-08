"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { isGrantValid } from "@/lib/pro-plan";
import { MAX_PROJECTS_FREE } from "@/lib/constants";
import { EnterItem, EnterList } from "@/components/motion";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";

const FREE_FEATURES = [
  { label: "Profil public", included: true },
  { label: `${MAX_PROJECTS_FREE} films en ligne max`, included: true },
  { label: "Apparaitre dans les credits", included: true },
  { label: "Films illimités", included: false },
  { label: "Messagerie directe", included: false },
  { label: "Contact talents", included: false },
  { label: "Badge Pro verifie", included: false },
  { label: "Priorite dans les resultats", included: false },
];

const PRO_FEATURES = [
  { label: "Profil public", included: true },
  { label: `Films illimités (au lieu de ${MAX_PROJECTS_FREE})`, included: true },
  { label: "Apparaitre dans les credits", included: true },
  { label: "Messagerie directe", included: true },
  { label: "Contact talents", included: true },
  { label: "Badge Pro verifie", included: true },
  { label: "Priorite dans les resultats", included: true },
  { label: "Support prioritaire", included: true },
];

// Interrupteur public : tant que false, le public voit la liste d'attente.
// Au lancement, passer NEXT_PUBLIC_BILLING_ENABLED=true (Vercel) => boutons d'achat.
const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

// Ligne d'argument : pastille coche (citron en Pro, verte en Gratuit) ou croix si non inclus.
function Feature({ label, included, accent = false }: { label: string; included: boolean; accent?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border ${
          !included
            ? "border-white/10 bg-white/5 text-text-tertiary"
            : accent
              ? "border-lime/30 bg-lime/15 text-lime"
              : "border-green-500/25 bg-green-500/10 text-green-500"
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d={included ? "M5 13l4 4L19 7" : "M18 6L6 18M6 6l12 12"} />
        </svg>
      </span>
      <span className={`text-sm leading-snug ${!included ? "text-text-tertiary" : accent ? "text-text-primary" : "text-text-secondary"}`}>
        {label}
      </span>
    </li>
  );
}

export default function ProPage() {
  // Waitlist (public)
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  // Détection viewer (admin override + déjà Pro ?)
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPro, setIsPro] = useState(false);
  // Pro offert (grant), independant de Stripe — chantier grants (2026-08-10).
  const [grantType, setGrantType] = useState<string | null>(null);
  const [grantExpiresAt, setGrantExpiresAt] = useState<string | null>(null);
  // Presence d'un customer Stripe — PAS `isPro` — decide l'affichage du bloc
  // "Gerer mon abonnement" (voir CORRECTION dans le commentaire de
  // api/me/route.ts : un Pro par grant seul n'a pas de stripe_customer_id, et
  // POST /api/billing/portal renvoie 400 sans lui).
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [busy, setBusy] = useState<"monthly" | "yearly" | "portal" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // is_admin et plan sont revoques pour anon/authenticated : plus de
        // lecture directe depuis le navigateur, on passe par la route serveur.
        // 401 (visiteur non connecte) => on laisse tous les etats a false/null.
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = await res.json();
        if (data.is_admin) setIsAdmin(true);
        if (data.plan === "pro") setIsPro(true);
        setGrantType(data.pro_grant_type ?? null);
        setGrantExpiresAt(data.pro_grant_expires_at ?? null);
        setHasStripeCustomer(!!data.has_stripe_customer);
      } catch {}
    })();
  }, []);

  // Bandeau "Pro offert" : decision produit (2026-08-10) — informer sans
  // interdire, les boutons d'achat restent visibles meme avec un grant valide
  // (ex. un VIP peut vouloir payer quand meme, ou juste comprendre pourquoi il
  // est deja Pro).
  const grantValid = isGrantValid(grantType, grantExpiresAt);
  const grantExpiryLabel = grantExpiresAt
    ? new Date(grantExpiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Les boutons d'achat sont visibles si le billing public est activé, OU pour un
  // admin (test). En mode test (billing public OFF) on affiche un bandeau clair.
  const showCheckout = BILLING_ENABLED || isAdmin;
  const testMode = !BILLING_ENABLED; // tant qu'on n'est pas live

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || null, type: "pro" }),
    });
    if (res.ok || res.status === 409) setSent(true);
    setSending(false);
  }

  async function startCheckout(interval: "monthly" | "yearly") {
    setBusy(interval);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = "/rejoindre"; return; }
      if (res.ok && data.url) { window.location.href = data.url; return; }
      alert(data.error || "Erreur");
    } catch { alert("Erreur réseau"); }
    finally { setBusy(null); }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      alert(data.error || "Erreur");
    } catch { alert("Erreur réseau"); }
    finally { setBusy(null); }
  }

  return (
    <EnterList className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-4 pt-6 pb-10 lg:gap-6 lg:pt-12 lg:pb-16">
      {/* Header */}
      <EnterItem className="text-center">
        <Badge variant="pro" className="mb-4">
          {showCheckout ? "Unkast Pro" : "Bientot disponible"}
        </Badge>
        <h1 className="text-sheen mb-3 text-[40px] font-bold lg:text-[56px]">
          Unkast Pro
        </h1>
        <p className="mx-auto max-w-[400px] text-[15px] leading-relaxed text-text-secondary">
          Deverrouille tout le potentiel d&apos;Unkast. Messagerie directe, films illimites, visibilite maximale.
        </p>
      </EnterItem>

      {/* Bandeau mode test (visible uniquement quand les boutons d'achat sont montrés en test) */}
      {showCheckout && testMode && (
        <EnterItem>
          <GlassCard className="border-orange-500/25 bg-orange-500/[0.08] px-4 py-3 text-center">
            <p className="text-xs leading-normal text-orange-500">
              Mode test — aucun paiement réel. Carte de test : 4242 4242 4242 4242.
            </p>
          </GlassCard>
        </EnterItem>
      )}

      {/* Comparison : empilee en mobile (offre Pro en premier), cote a cote des md */}
      <EnterItem className="grid gap-4 md:grid-cols-2 lg:gap-5">
        {/* Free */}
        <GlassCard radius="panel" className="p-5 lg:p-7">
          <Badge variant="neutral">Gratuit</Badge>
          <p className="mt-4 mb-5 text-5xl font-bold leading-[1.1] tracking-tight text-text-primary lg:text-6xl">0€</p>
          <ul className="flex flex-col gap-3">
            {FREE_FEATURES.map((f) => (
              <Feature key={f.label} label={f.label} included={f.included} />
            ))}
          </ul>
        </GlassCard>

        {/* Pro */}
        <GlassCard
          strong
          radius="panel"
          className="border-lime/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_24px_70px_rgba(200,255,0,0.10)] max-md:order-first lg:p-7"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge variant="pro">Pro</Badge>
            <span className="inline-flex h-6 items-center rounded-pill bg-lime px-2.5 text-xs font-bold leading-none text-canvas">Recommande</span>
          </div>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-sheen text-6xl font-bold leading-[1.1] tracking-tight lg:text-7xl">9,99 €</span>
            <span className="text-base text-text-secondary">/mois</span>
          </p>
          <p className="mt-1 mb-5 text-sm text-text-secondary">ou 99,90 €/an — 2 mois offerts</p>
          <ul className="flex flex-col gap-3">
            {PRO_FEATURES.map((f) => (
              <Feature key={f.label} label={f.label} included={f.included} accent />
            ))}
          </ul>
        </GlassCard>
      </EnterItem>

      {/* Bandeau "Pro offert" : au-dessus du bloc d'achat/gestion, visible tant
          que le grant reste valide, independamment de showCheckout/isPro. */}
      {grantValid && (
        <EnterItem className="mx-auto w-full max-w-xl">
          <GlassCard className="border-lime/20 bg-lime/[0.04] px-4 py-3">
            <p className="text-[13px] leading-normal text-lime">
              Tu bénéficies déjà d&apos;un Pro offert{grantExpiryLabel ? ` — jusqu'au ${grantExpiryLabel}` : " — sans échéance"}.
            </p>
          </GlassCard>
        </EnterItem>
      )}

      {/* Bloc action : boutons d'achat (billing activé / admin) OU liste d'attente (public) */}
      <EnterItem className="mx-auto w-full max-w-xl">
        {showCheckout ? (
          <GlassCard radius="panel" className="p-5 lg:p-7">
            {/* isPro seul suffisait avant le chantier grants (une seule source de
                Pro). Desormais isPro peut venir d'un grant SANS stripe_customer_id
                (portal 400) ; hasStripeCustomer seul se tromperait en sens inverse
                (un ex-abonne resilie garde son customer id a vie, cf. checkout/route.ts,
                et se verrait "Tu es Pro" a tort). Les deux ensemble seulement. */}
            {isPro && hasStripeCustomer ? (
              <>
                <h3 className="mb-1.5 text-lg font-semibold text-text-primary">Tu es Pro</h3>
                <p className="mb-5 text-sm leading-normal text-text-secondary">Gère ton abonnement (résiliation, carte, mensuel/annuel) via le portail sécurisé Stripe.</p>
                <Button variant="glass" size="lg" onClick={openPortal} disabled={busy === "portal"} className="w-full">
                  {busy === "portal" ? "Ouverture…" : "Gérer mon abonnement"}
                </Button>
              </>
            ) : (
              <>
                <h3 className="mb-1.5 text-lg font-semibold text-text-primary">Passer à Pro</h3>
                <p className="mb-5 text-sm leading-normal text-text-secondary">Choisis ta formule. Paiement sécurisé par Stripe.</p>
                {/* px-3 : le libelle annuel tient sur une ligne a 360 px */}
                <div className="flex flex-col gap-3">
                  <Button size="lg" onClick={() => startCheckout("monthly")} disabled={busy !== null} className="w-full px-3! text-center text-sm!">
                    {busy === "monthly" ? "Redirection…" : "Mensuel — 9,99 €/mois"}
                  </Button>
                  <Button variant="glass" size="lg" onClick={() => startCheckout("yearly")} disabled={busy !== null} className="w-full px-3! text-center text-sm!">
                    {busy === "yearly" ? "Redirection…" : "Annuel — 99,90 €/an (2 mois offerts)"}
                  </Button>
                </div>
              </>
            )}
          </GlassCard>
        ) : (
          <GlassCard radius="panel" className="p-5 lg:p-7">
            {sent ? (
              <div className="py-3 text-center">
                <span aria-hidden="true" className="mx-auto mb-4 flex size-14 items-center justify-center rounded-pill border border-green-500/30 bg-green-500/10 text-green-500">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </span>
                <p className="mb-1.5 text-lg font-semibold text-text-primary">Tu es sur la liste !</p>
                <p className="text-sm text-text-secondary">On te previent des que Pro est disponible.</p>
              </div>
            ) : (
              <>
                <h3 className="mb-1.5 text-lg font-semibold text-text-primary">Rejoins la liste d&apos;attente</h3>
                <p className="mb-5 text-sm leading-normal text-text-secondary">Sois parmi les premiers a acceder a Pro.</p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <Field type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton nom (optionnel)" aria-label="Ton nom (optionnel)" />
                  <Field type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ton email" aria-label="Ton email" />
                  <Button type="submit" size="lg" disabled={sending || !email} className="mt-1 w-full">
                    {sending ? "Envoi..." : "Rejoindre la liste d'attente"}
                  </Button>
                </form>
              </>
            )}
          </GlassCard>
        )}
      </EnterItem>

      <EnterItem>
        <p className="text-center text-xs text-text-secondary">
          Des questions ? <Link href="mailto:pro@unkast.com" className="inline-flex min-h-11 items-center text-lime hover:underline">pro@unkast.com</Link>
        </p>
      </EnterItem>
    </EnterList>
  );
}
