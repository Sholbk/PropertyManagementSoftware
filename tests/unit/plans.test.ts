import { describe, it, expect } from "vitest";
import { PLAN_TIERS, getLimitsForPlan, planFromStripePriceId, ADD_ONS } from "@/lib/plans";

describe("PLAN_TIERS", () => {
  it("has all four tiers defined", () => {
    expect(Object.keys(PLAN_TIERS)).toEqual(["free", "starter", "professional", "enterprise"]);
  });

  it("free tier has no marketplace access", () => {
    expect(PLAN_TIERS.free.limits.marketplace_access).toBe(false);
  });

  it("enterprise tier has unlimited properties", () => {
    expect(PLAN_TIERS.enterprise.limits.max_properties).toBe(-1);
  });

  it("prices increase with tier", () => {
    expect(PLAN_TIERS.free.price_monthly).toBe(0);
    expect(PLAN_TIERS.starter.price_monthly).toBeLessThan(PLAN_TIERS.professional.price_monthly);
    expect(PLAN_TIERS.professional.price_monthly).toBeLessThan(PLAN_TIERS.enterprise.price_monthly);
  });

  it("AI limits increase with tier", () => {
    expect(PLAN_TIERS.free.limits.ai_calls_per_day).toBeLessThan(PLAN_TIERS.starter.limits.ai_calls_per_day);
    expect(PLAN_TIERS.starter.limits.ai_calls_per_day).toBeLessThan(PLAN_TIERS.professional.limits.ai_calls_per_day);
  });
});

describe("getLimitsForPlan", () => {
  it("returns correct limits for known plans", () => {
    expect(getLimitsForPlan("free")).toEqual(PLAN_TIERS.free.limits);
    expect(getLimitsForPlan("starter")).toEqual(PLAN_TIERS.starter.limits);
    expect(getLimitsForPlan("professional")).toEqual(PLAN_TIERS.professional.limits);
    expect(getLimitsForPlan("enterprise")).toEqual(PLAN_TIERS.enterprise.limits);
  });

  it("returns free limits for unknown plan", () => {
    expect(getLimitsForPlan("nonexistent")).toEqual(PLAN_TIERS.free.limits);
  });
});

describe("planFromStripePriceId", () => {
  it("returns null for unknown price ID", () => {
    expect(planFromStripePriceId("price_unknown")).toBeNull();
  });

  it("returns null when no Stripe prices are configured", () => {
    // Without STRIPE_PRICE_* env vars, all price IDs are null
    expect(planFromStripePriceId("")).toBeNull();
  });
});

describe("ADD_ONS", () => {
  it("has three add-ons defined", () => {
    expect(ADD_ONS).toHaveLength(3);
  });

  it("owner reporting is per-property", () => {
    const ownerReporting = ADD_ONS.find((a) => a.slug === "owner_reporting");
    expect(ownerReporting?.per_property).toBe(true);
  });

  it("all add-ons have slugs", () => {
    for (const addon of ADD_ONS) {
      expect(addon.slug).toBeTruthy();
    }
  });
});
