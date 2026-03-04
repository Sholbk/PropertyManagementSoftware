import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const { priceId } = await request.json();
  if (!priceId) {
    return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
  }

  // Get org's existing Stripe customer ID
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id, billing_email")
    .eq("id", orgId)
    .single();

  const stripe = getStripe();

  const sessionParams: Record<string, unknown> = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${request.nextUrl.origin}/settings/billing?success=true`,
    cancel_url: `${request.nextUrl.origin}/settings/billing?cancelled=true`,
    metadata: { org_id: orgId },
    subscription_data: { metadata: { org_id: orgId } },
  };

  if (org?.stripe_customer_id) {
    sessionParams.customer = org.stripe_customer_id;
  } else {
    sessionParams.customer_email = org?.billing_email ?? user.email;
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
  );

  return NextResponse.json({ url: session.url });
}
