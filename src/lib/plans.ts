// ============================================================================
// Plan Tier Definitions & Feature Limits
// ============================================================================

export interface PlanLimits {
  max_properties: number;       // -1 = unlimited
  max_users: number;            // -1 = unlimited
  ai_calls_per_day: number;
  ai_calls_per_hour: number;
  marketplace_access: boolean;
  benchmark_access: boolean;
  owner_reporting: boolean;
  maintenance_markup: boolean;
}

export type PlanTier = "free" | "starter" | "professional" | "enterprise";

export interface PlanDefinition {
  name: string;
  price_monthly: number;
  stripe_price_id: string | null;
  limits: PlanLimits;
}

export const PLAN_TIERS: Record<PlanTier, PlanDefinition> = {
  free: {
    name: "Free",
    price_monthly: 0,
    stripe_price_id: null,
    limits: {
      max_properties: 2,
      max_users: 2,
      ai_calls_per_day: 5,
      ai_calls_per_hour: 2,
      marketplace_access: false,
      benchmark_access: false,
      owner_reporting: false,
      maintenance_markup: false,
    },
  },
  starter: {
    name: "Starter",
    price_monthly: 29,
    stripe_price_id: process.env.STRIPE_PRICE_STARTER ?? null,
    limits: {
      max_properties: 10,
      max_users: 5,
      ai_calls_per_day: 50,
      ai_calls_per_hour: 10,
      marketplace_access: true,
      benchmark_access: false,
      owner_reporting: false,
      maintenance_markup: true,
    },
  },
  professional: {
    name: "Professional",
    price_monthly: 79,
    stripe_price_id: process.env.STRIPE_PRICE_PROFESSIONAL ?? null,
    limits: {
      max_properties: 50,
      max_users: 15,
      ai_calls_per_day: 200,
      ai_calls_per_hour: 50,
      marketplace_access: true,
      benchmark_access: true,
      owner_reporting: true,
      maintenance_markup: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    price_monthly: 199,
    stripe_price_id: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    limits: {
      max_properties: -1,
      max_users: -1,
      ai_calls_per_day: 1000,
      ai_calls_per_hour: 200,
      marketplace_access: true,
      benchmark_access: true,
      owner_reporting: true,
      maintenance_markup: true,
    },
  },
} as const;

export interface AddOnDefinition {
  name: string;
  slug: string;
  price_monthly: number;
  per_property?: boolean;
  stripe_price_id: string | null;
  grants_feature: keyof PlanLimits | null;
}

export const ADD_ONS: AddOnDefinition[] = [
  {
    name: "Owner Reporting",
    slug: "owner_reporting",
    price_monthly: 5,
    per_property: true,
    stripe_price_id: process.env.STRIPE_PRICE_OWNER_REPORTING ?? null,
    grants_feature: "owner_reporting",
  },
  {
    name: "Benchmark Data",
    slug: "benchmark_data",
    price_monthly: 19,
    stripe_price_id: process.env.STRIPE_PRICE_BENCHMARKS ?? null,
    grants_feature: "benchmark_access",
  },
  {
    name: "Featured Vendor Listing",
    slug: "vendor_featured_listing",
    price_monthly: 49,
    stripe_price_id: process.env.STRIPE_PRICE_VENDOR_FEATURED ?? null,
    grants_feature: null,
  },
];

/** Look up a plan tier by its Stripe price ID */
export function planFromStripePriceId(priceId: string): PlanTier | null {
  for (const [tier, def] of Object.entries(PLAN_TIERS)) {
    if (def.stripe_price_id === priceId) return tier as PlanTier;
  }
  return null;
}

/** Get the default plan limits for a tier */
export function getLimitsForPlan(plan: string): PlanLimits {
  return PLAN_TIERS[plan as PlanTier]?.limits ?? PLAN_TIERS.free.limits;
}
