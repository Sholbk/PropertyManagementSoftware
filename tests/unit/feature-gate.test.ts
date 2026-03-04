import { describe, it, expect } from "vitest";
import {
  canAccessFeature,
  getAiLimits,
  canAddProperty,
  canAddUser,
  minimumPlanForFeature,
  type OrgPlan,
} from "@/lib/feature-gate";
import { PLAN_TIERS } from "@/lib/plans";

function makeOrg(overrides: Partial<OrgPlan> = {}): OrgPlan {
  return {
    plan: "starter",
    plan_limits: { ...PLAN_TIERS.starter.limits },
    add_ons: [],
    subscription_status: "active",
    ...overrides,
  };
}

describe("canAccessFeature", () => {
  it("grants boolean features when plan includes them", () => {
    const org = makeOrg({ plan: "starter" });
    expect(canAccessFeature(org, "marketplace_access")).toBe(true);
    expect(canAccessFeature(org, "maintenance_markup")).toBe(true);
  });

  it("denies boolean features when plan does not include them", () => {
    const org = makeOrg({
      plan: "free",
      plan_limits: { ...PLAN_TIERS.free.limits },
    });
    expect(canAccessFeature(org, "marketplace_access")).toBe(false);
    expect(canAccessFeature(org, "benchmark_access")).toBe(false);
  });

  it("grants features via add-ons regardless of plan", () => {
    const org = makeOrg({
      plan: "free",
      plan_limits: { ...PLAN_TIERS.free.limits },
      add_ons: ["benchmark_access"],
    });
    expect(canAccessFeature(org, "benchmark_access")).toBe(true);
  });

  it("denies all premium features when subscription is cancelled", () => {
    const org = makeOrg({ subscription_status: "cancelled" });
    expect(canAccessFeature(org, "marketplace_access")).toBe(false);
  });

  it("allows numeric features when value > 0", () => {
    const org = makeOrg();
    expect(canAccessFeature(org, "ai_calls_per_day")).toBe(true);
  });
});

describe("getAiLimits", () => {
  it("returns plan-based limits", () => {
    const org = makeOrg({ plan: "professional", plan_limits: { ...PLAN_TIERS.professional.limits } });
    const limits = getAiLimits(org);
    expect(limits.maxPerDay).toBe(200);
    expect(limits.maxPerHour).toBe(50);
  });

  it("returns free limits for free plan", () => {
    const org = makeOrg({ plan: "free", plan_limits: { ...PLAN_TIERS.free.limits } });
    const limits = getAiLimits(org);
    expect(limits.maxPerDay).toBe(5);
    expect(limits.maxPerHour).toBe(2);
  });
});

describe("canAddProperty", () => {
  it("allows when under limit", () => {
    const org = makeOrg(); // starter: 10 max
    expect(canAddProperty(org, 5)).toBe(true);
  });

  it("denies when at limit", () => {
    const org = makeOrg(); // starter: 10 max
    expect(canAddProperty(org, 10)).toBe(false);
  });

  it("always allows for unlimited (-1)", () => {
    const org = makeOrg({ plan: "enterprise", plan_limits: { ...PLAN_TIERS.enterprise.limits } });
    expect(canAddProperty(org, 999)).toBe(true);
  });
});

describe("canAddUser", () => {
  it("allows when under limit", () => {
    const org = makeOrg(); // starter: 5 max
    expect(canAddUser(org, 3)).toBe(true);
  });

  it("denies when at limit", () => {
    const org = makeOrg(); // starter: 5 max
    expect(canAddUser(org, 5)).toBe(false);
  });

  it("always allows for unlimited (-1)", () => {
    const org = makeOrg({ plan: "enterprise", plan_limits: { ...PLAN_TIERS.enterprise.limits } });
    expect(canAddUser(org, 999)).toBe(true);
  });
});

describe("minimumPlanForFeature", () => {
  it("returns starter for marketplace_access", () => {
    expect(minimumPlanForFeature("marketplace_access")).toBe("starter");
  });

  it("returns professional for benchmark_access", () => {
    expect(minimumPlanForFeature("benchmark_access")).toBe("professional");
  });

  it("returns free for ai_calls_per_day (all plans have > 0)", () => {
    expect(minimumPlanForFeature("ai_calls_per_day")).toBe("free");
  });
});
