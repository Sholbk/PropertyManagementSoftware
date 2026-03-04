import { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_TIERS, type PlanLimits, type PlanTier } from "./plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export interface OrgPlan {
  plan: string;
  plan_limits: PlanLimits;
  add_ons: string[];
  subscription_status: string;
}

/** Fetch org plan info from the database */
export async function getOrgPlan(supabase: Client, orgId: string): Promise<OrgPlan | null> {
  const { data } = await supabase
    .from("organizations")
    .select("plan, plan_limits, add_ons, subscription_status")
    .eq("id", orgId)
    .single();

  if (!data) return null;

  // Merge stored plan_limits with defaults for the plan tier
  const defaults = PLAN_TIERS[(data.plan as PlanTier)]?.limits ?? PLAN_TIERS.free.limits;
  const limits: PlanLimits = { ...defaults, ...data.plan_limits };

  return {
    plan: data.plan,
    plan_limits: limits,
    add_ons: data.add_ons ?? [],
    subscription_status: data.subscription_status ?? "trialing",
  };
}

/** Check if an org can access a specific feature */
export function canAccessFeature(org: OrgPlan, feature: keyof PlanLimits): boolean {
  // Cancelled subscriptions lose premium features
  if (org.subscription_status === "cancelled") return false;

  // Check add-ons first (they grant features regardless of plan)
  if (org.add_ons.includes(feature)) return true;

  // Check plan limits
  const value = org.plan_limits[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
}

/** Get AI usage limits for the org */
export function getAiLimits(org: OrgPlan): { maxPerDay: number; maxPerHour: number } {
  return {
    maxPerDay: org.plan_limits.ai_calls_per_day ?? 5,
    maxPerHour: org.plan_limits.ai_calls_per_hour ?? 2,
  };
}

/** Check if org has reached property limit */
export function canAddProperty(org: OrgPlan, currentCount: number): boolean {
  const limit = org.plan_limits.max_properties;
  if (limit === -1) return true; // unlimited
  return currentCount < limit;
}

/** Check if org has reached user limit */
export function canAddUser(org: OrgPlan, currentCount: number): boolean {
  const limit = org.plan_limits.max_users;
  if (limit === -1) return true; // unlimited
  return currentCount < limit;
}

/** Get the minimum plan tier required for a feature */
export function minimumPlanForFeature(feature: keyof PlanLimits): PlanTier {
  const tiers: PlanTier[] = ["free", "starter", "professional", "enterprise"];
  for (const tier of tiers) {
    const value = PLAN_TIERS[tier].limits[feature];
    if (typeof value === "boolean" && value) return tier;
    if (typeof value === "number" && value > 0) return tier;
  }
  return "enterprise";
}
