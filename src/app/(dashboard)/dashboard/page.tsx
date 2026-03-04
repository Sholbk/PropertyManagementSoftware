import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortfolioSnapshots, getProperties, getOpenWorkOrderCount, getRecentAiInsights } from "@/lib/queries";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { PropertyComparison } from "@/components/dashboard/property-comparison";
import { VacancyBar } from "@/components/dashboard/vacancy-bar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { PerformanceSnapshot, Property, AiActionLog } from "@/types/database";

export const metadata = {
  title: "Dashboard | PMPP",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) {
    return (
      <EmptyState
        title="No organization selected"
        description="Please contact your administrator to set up your organization."
      />
    );
  }

  // Fetch data in parallel
  const [snapshotsRes, propertiesRes, workOrderCountRes, propertySnapshotsRes, aiInsightsRes] = await Promise.all([
    getPortfolioSnapshots(supabase, orgId),
    getProperties(supabase, orgId),
    getOpenWorkOrderCount(supabase, orgId),
    // All property-level snapshots for comparison
    supabase
      .from("performance_snapshots")
      .select("*")
      .eq("organization_id", orgId)
      .not("property_id", "is", null)
      .eq("period_type", "monthly")
      .order("period_date", { ascending: false })
      .limit(100),
    getRecentAiInsights(supabase, orgId, 5),
  ]);

  const snapshots = (snapshotsRes.data ?? []) as PerformanceSnapshot[];
  const properties = (propertiesRes.data ?? []) as Pick<Property, "id" | "name" | "property_type" | "address_line1" | "city" | "state" | "zip" | "year_built" | "total_sqft" | "manager_id">[];
  const openWorkOrders = workOrderCountRes.count ?? 0;
  const propertySnapshots = (propertySnapshotsRes.data ?? []) as PerformanceSnapshot[];
  const aiInsights = (aiInsightsRes.data ?? []) as Pick<AiActionLog, "id" | "action_type" | "domain" | "context_entity" | "context_id" | "output_summary" | "was_accepted" | "created_at">[];

  const current = snapshots[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Portfolio Overview</h1>

      {/* KPI Cards */}
      <KpiGrid snapshots={snapshots} openWorkOrders={openWorkOrders} />

      {/* Units summary bar */}
      {current && current.total_units && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Unit Occupancy</h3>
          <VacancyBar
            occupied={current.occupied_units ?? 0}
            vacant={current.vacant_units ?? 0}
            total={current.total_units}
          />
        </Card>
      )}

      {/* Property Comparison */}
      <PropertyComparison properties={properties} snapshots={propertySnapshots} />

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent AI Insights</h3>
          <div className="space-y-3">
            {aiInsights.map((insight) => (
              <div key={insight.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {insight.domain}
                  </span>
                  <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                    {insight.action_type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-700">{insight.output_summary}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {properties.length === 0 && (
        <EmptyState
          title="No properties yet"
          description="Add your first property to start tracking performance."
        />
      )}
    </div>
  );
}
