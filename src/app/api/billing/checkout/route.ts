import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, priceIdForInterval, siteUrl } from "@/lib/stripe";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// POST { interval: 'monthly' | 'yearly' } : crée une session Stripe Checkout
// (mode abonnement) et renvoie son URL. N'ACCORDE PAS le Pro — c'est le webhook
// qui le fait une fois le paiement confirmé.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { interval } = body;
  if (interval !== "monthly" && interval !== "yearly") {
    return NextResponse.json({ error: "interval invalide (monthly|yearly)." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", user.id)
    .single();

  const stripe = getStripe();

  // Réutilise le customer Stripe existant, sinon en crée un et le persiste.
  let customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: { profile_id: user.id },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdForInterval(interval), quantity: 1 }],
    client_reference_id: user.id,
    allow_promotion_codes: true,
    success_url: `${siteUrl()}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/pro/cancel`,
  });

  return NextResponse.json({ url: session.url });
}
