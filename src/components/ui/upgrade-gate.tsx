"use client";

import { useFeatureGate } from "@/hooks/use-feature-gate";
import { minimumPlanForFeature } from "@/lib/feature-gate";
import { PLAN_TIERS, type PlanLimits } from "@/lib/plans";
import Link from "next/link";

interface UpgradeGateProps {
  feature: keyof PlanLimits;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function UpgradeGate({ feature, children, fallback }: UpgradeGateProps) {
  const { canUse, isLoading } = useFeatureGate();

  if (isLoading) return null;

  if (canUse(feature)) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  const requiredPlan = minimumPlanForFeature(feature);
  const planName = PLAN_TIERS[requiredPlan].name;

  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div className="relative z-10">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="mt-3 text-lg font-semibold text-gray-900">
          Upgrade to {planName}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          This feature requires the {planName} plan or higher.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          View Plans
        </Link>
      </div>
    </div>
  );
}
