import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { getLimitsForPlan, planFromStripePriceId } from "@/lib/plans";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Log the event
  const eventObj = event.data.object as unknown as Record<string, unknown>;
  const orgId = (eventObj.metadata as Record<string, string> | undefined)?.org_id;
  if (orgId) {
    await supabase.from("subscription_events").insert({
      organization_id: orgId,
      stripe_event_id: event.id,
      event_type: event.type,
      payload: eventObj,
      processed_at: new Date().toISOString(),
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as Record<string, unknown>;
      const sessionMeta = session.metadata as Record<string, string> | undefined;
      const sessionOrgId = sessionMeta?.org_id;
      if (sessionOrgId && session.customer && session.subscription) {
        await supabase
          .from("organizations")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_status: "active",
          })
          .eq("id", sessionOrgId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const subMeta = subscription.metadata as Record<string, string> | undefined;
      const subOrgId = subMeta?.org_id;
      if (subOrgId) {
        const items = subscription.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
        const priceId = items?.data?.[0]?.price?.id;
        const plan = priceId ? planFromStripePriceId(priceId) : null;
        const status = subscription.status as string;

        const updates: Record<string, unknown> = {
          subscription_status: status === "active" ? "active" : status === "trialing" ? "trialing" : "past_due",
        };

        if (plan) {
          updates.plan = plan;
          updates.plan_limits = getLimitsForPlan(plan);
        }

        await supabase.from("organizations").update(updates).eq("id", subOrgId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const delSub = event.data.object as unknown as Record<string, unknown>;
      const delMeta = delSub.metadata as Record<string, string> | undefined;
      const delOrgId = delMeta?.org_id;
      if (delOrgId) {
        await supabase
          .from("organizations")
          .update({
            subscription_status: "cancelled",
            plan: "free",
            plan_limits: getLimitsForPlan("free"),
          })
          .eq("id", delOrgId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const failInvoice = event.data.object as unknown as Record<string, unknown>;
      const failMeta = failInvoice.metadata as Record<string, string> | undefined;
      const failOrgId = failMeta?.org_id;
      if (failOrgId) {
        await supabase
          .from("organizations")
          .update({ subscription_status: "past_due" })
          .eq("id", failOrgId);
      }
      break;
    }

    case "invoice.paid": {
      const paidInvoice = event.data.object as unknown as Record<string, unknown>;
      const paidMeta = paidInvoice.metadata as Record<string, string> | undefined;
      const paidOrgId = paidMeta?.org_id;
      if (paidOrgId) {
        await supabase
          .from("organizations")
          .update({ subscription_status: "active" })
          .eq("id", paidOrgId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
