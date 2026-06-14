import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Webhook Stripe — SEULE source de vérité pour accorder/retirer le Pro.
// Vérifie la signature sur le RAW body. Met à jour profiles par stripe_customer_id.
//
// Garde-fou : un profil pro_source='admin' (Pro accordé manuellement = à vie)
// n'est JAMAIS rétrogradé ; le webhook ne met à jour que la comptabilité Stripe.
// Un profil sans stripe_customer_id n'est jamais retrouvé => jamais touché.

// Statuts Stripe considérés comme "Pro actif" (past_due = période de grâce).
const PRO_STATUSES = ["active", "trialing", "past_due"];

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 500 });
  }

  const rawBody = await request.text(); // indispensable pour la vérif de signature
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature invalide: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Applique l'état d'un abonnement Stripe au profil correspondant.
  async function applySubscription(subInput: Stripe.Subscription, fallbackUserId?: string) {
    // Cast souple : on ne lit que quelques champs, indépendamment des évolutions
    // de typage Stripe (current_period_end peut vivre au niveau item selon l'API).
    const sub = subInput as unknown as {
      id: string;
      status: string;
      customer: string | { id: string };
      current_period_end?: number;
      items?: { data?: { current_period_end?: number }[] };
    };
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    // Retrouver le profil par customer ; sinon, au tout premier paiement, via
    // client_reference_id (et on rattache alors le customer au profil).
    let { data: profile } = await admin
      .from("profiles")
      .select("id, plan, pro_since, pro_source")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (!profile && fallbackUserId) {
      const { data: p } = await admin
        .from("profiles")
        .select("id, plan, pro_since, pro_source")
        .eq("id", fallbackUserId)
        .maybeSingle();
      if (p) {
        await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", p.id);
        profile = p;
      }
    }
    if (!profile) return; // customer inconnu => on ignore

    const status = sub.status;
    const isPro = PRO_STATUSES.includes(status);
    const periodEndUnix = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;

    const updates: Record<string, unknown> = {
      stripe_subscription_id: sub.id,
      subscription_status: status,
      current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
    };

    if (profile.pro_source === "admin") {
      // Pro manuel = à vie : on ne touche NI plan NI pro_source.
    } else if (isPro) {
      updates.plan = "pro";
      updates.pro_source = "stripe";
      if (!profile.pro_since) updates.pro_since = new Date().toISOString();
    } else {
      // canceled / unpaid / incomplete_expired ... => retrait du Pro.
      updates.plan = "free";
    }

    await admin.from("profiles").update(updates).eq("id", profile.id);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await applySubscription(sub, session.client_reference_id ?? undefined);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await applySubscription(event.data.object as Stripe.Subscription);
      break;
    }
    // invoice.payment_failed n'est pas traité directement : Stripe émet ensuite
    // un customer.subscription.updated (past_due/unpaid) qui pilote le retrait.
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
