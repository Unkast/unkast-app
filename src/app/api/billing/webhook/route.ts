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

  // Idempotence (table stripe_events) : un événement rejoué (retry Stripe,
  // "resend" manuel, replay) ne doit JAMAIS ré-écrire profiles — sinon un
  // événement obsolète peut ré-accorder le Pro. On revendique event.id AVANT
  // toute écriture :
  //  - insert OK        => premier passage, on traite ;
  //  - 23505 (déjà vu)  => 200 sans rien toucher ;
  //  - 42P01 (table absente : migration 20260702_stripe_events.sql non
  //    exécutée) => on traite SANS dédup, loggé fort (sécurité de déploiement :
  //    le webhook ne casse pas si le code part avant la migration) ;
  //  - autre erreur     => 500, Stripe re-tentera.
  let dedupActive = true;
  const { error: claimError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (claimError.code === "42P01") {
      dedupActive = false;
      console.error(
        "[stripe-webhook] table stripe_events absente — événement traité SANS idempotence. Exécuter supabase/migrations/20260702_stripe_events.sql."
      );
    } else {
      console.error("[stripe-webhook] stripe_events insert error:", claimError);
      return NextResponse.json({ error: "Idempotence indisponible." }, { status: 500 });
    }
  }

  // Applique l'état d'un abonnement Stripe au profil correspondant.
  // Toute écriture/lecture en échec THROW : le catch global libère la
  // revendication d'idempotence et renvoie 500 (Stripe rejouera l'événement).
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
    let { data: profile, error: readError } = await admin
      .from("profiles")
      .select("id, plan, pro_since, pro_source")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (readError) throw new Error(`lecture profil par customer ${customerId}: ${readError.message}`);

    if (!profile && fallbackUserId) {
      const { data: p, error: fallbackError } = await admin
        .from("profiles")
        .select("id, plan, pro_since, pro_source")
        .eq("id", fallbackUserId)
        .maybeSingle();
      if (fallbackError) throw new Error(`lecture profil ${fallbackUserId}: ${fallbackError.message}`);
      if (p) {
        const { error: attachError } = await admin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", p.id);
        if (attachError) throw new Error(`rattachement customer au profil ${p.id}: ${attachError.message}`);
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

    const { error: updateError } = await admin.from("profiles").update(updates).eq("id", profile.id);
    if (updateError) throw new Error(`update profil ${profile.id}: ${updateError.message}`);
  }

  try {
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
  } catch (err) {
    // Échec de traitement : on libère la revendication pour que le retry Stripe
    // puisse rejouer l'événement (sinon il serait dédupliqué à tort et perdu).
    console.error(`[stripe-webhook] échec du traitement de ${event.id} (${event.type}):`, err);
    if (dedupActive) {
      const { error: releaseError } = await admin.from("stripe_events").delete().eq("id", event.id);
      if (releaseError) {
        console.error(`[stripe-webhook] libération de ${event.id} échouée (retry Stripe sera dédupliqué !):`, releaseError);
      }
    }
    return NextResponse.json({ error: "Traitement échoué, événement à rejouer." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
