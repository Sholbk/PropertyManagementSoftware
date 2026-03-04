"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlanLimits } from "@/lib/plans";

interface FeatureGateState {
  plan: string | null;
  planLimits: PlanLimits | null;
  addOns: string[];
  subscriptionStatus: string | null;
  isLoading: boolean;
}

export function useFeatureGate() {
  const [state, setState] = useState<FeatureGateState>({
    plan: null,
    planLimits: null,
    addOns: [],
    subscriptionStatus: null,
    isLoading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    async function fetchPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      const orgId = user.app_metadata?.active_org_id;
      if (!orgId) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      const { data } = await supabase
        .from("organizations")
        .select("plan, plan_limits, add_ons, subscription_status")
        .eq("id", orgId)
        .single();

      if (data) {
        setState({
          plan: data.plan,
          planLimits: data.plan_limits as PlanLimits,
          addOns: data.add_ons ?? [],
          subscriptionStatus: data.subscription_status,
          isLoading: false,
        });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    }

    fetchPlan();
  }, []);

  function canUse(feature: keyof PlanLimits): boolean {
    if (state.isLoading || !state.planLimits) return false;
    if (state.subscriptionStatus === "cancelled") return false;
    if (state.addOns.includes(feature)) return true;
    const value = state.planLimits[feature];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    return false;
  }

  return { ...state, canUse };
}
