import "server-only";
import Stripe from "stripe";

// Client Stripe SERVEUR uniquement (clé secrète via env, JAMAIS dans le code).
// Singleton paresseux : on n'instancie qu'au premier appel d'une route billing,
// et on ne fait pas planter le build si la clé n'est pas encore renseignée.

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquante (voir .env.local).");
  }
  // apiVersion volontairement omise => version par défaut du compte Stripe.
  _stripe = new Stripe(key);
  return _stripe;
}

// Price ID (TEST) correspondant à l'intervalle choisi.
export function priceIdForInterval(interval: "monthly" | "yearly"): string {
  const id =
    interval === "yearly"
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY;
  if (!id) {
    throw new Error(`Price ID manquant pour l'intervalle "${interval}" (voir .env.local).`);
  }
  return id;
}

// Base d'URL pour les redirections Checkout/Portal (localhost en dev).
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
