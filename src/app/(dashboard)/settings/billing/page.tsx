"use client";

import { useState } from "react";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { PLAN_TIERS, ADD_ONS, type PlanTier } from "@/lib/plans";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const tierOrder: PlanTier[] = ["free", "starter", "professional", "enterprise"];

export default function BillingPage() {
  const { plan, subscriptionStatus, isLoading } = useFeatureGate();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  async function handleUpgrade(priceId: string) {
    setCheckoutLoading(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManageBilling() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>

      {/* Current Plan */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Current Plan</h3>
            <p className="mt-1 text-2xl font-bold capitalize text-gray-900">
              {plan ?? "Free"}
            </p>
            <Badge
              variant={subscriptionStatus === "active" ? "success" : subscriptionStatus === "trialing" ? "info" : "warning"}
              className="mt-1"
            >
              {subscriptionStatus ?? "trialing"}
            </Badge>
          </div>
          {plan !== "free" && (
            <Button variant="secondary" onClick={handleManageBilling}>
              Manage Billing
            </Button>
          )}
        </div>
      </Card>

      {/* Plan Comparison */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tierOrder.map((tier) => {
          const def = PLAN_TIERS[tier];
          const isCurrent = plan === tier;
          return (
            <Card key={tier} className={isCurrent ? "ring-2 ring-blue-500" : ""}>
              <h3 className="text-lg font-bold text-gray-900">{def.name}</h3>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                ${def.price_monthly}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>{def.limits.max_properties === -1 ? "Unlimited" : def.limits.max_properties} properties</li>
                <li>{def.limits.max_users === -1 ? "Unlimited" : def.limits.max_users} team members</li>
                <li>{def.limits.ai_calls_per_day} AI calls/day</li>
                <li>{def.limits.marketplace_access ? "Vendor Marketplace" : "—"}</li>
                <li>{def.limits.benchmark_access ? "Benchmark Data" : "—"}</li>
                <li>{def.limits.owner_reporting ? "Owner Reporting" : "—"}</li>
                <li>{def.limits.maintenance_markup ? "Markup Tracking" : "—"}</li>
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <Badge variant="info">Current Plan</Badge>
                ) : def.stripe_price_id ? (
                  <Button
                    onClick={() => handleUpgrade(def.stripe_price_id!)}
                    loading={checkoutLoading === def.stripe_price_id}
                    className="w-full"
                  >
                    {tierOrder.indexOf(tier) > tierOrder.indexOf(plan as PlanTier) ? "Upgrade" : "Switch"}
                  </Button>
                ) : tier === "free" ? (
                  <span className="text-xs text-gray-400">Default plan</span>
                ) : (
                  <span className="text-xs text-gray-400">Configure Stripe price IDs to enable</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add-ons */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Available Add-ons</h3>
        <div className="space-y-3">
          {ADD_ONS.map((addon) => (
            <div key={addon.slug} className="flex items-center justify-between rounded-md border border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{addon.name}</p>
                <p className="text-xs text-gray-500">
                  ${addon.price_monthly}/mo{addon.per_property ? " per property" : ""}
                </p>
              </div>
              {addon.stripe_price_id ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUpgrade(addon.stripe_price_id!)}
                  loading={checkoutLoading === addon.stripe_price_id}
                >
                  Add
                </Button>
              ) : (
                <span className="text-xs text-gray-400">Coming soon</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
