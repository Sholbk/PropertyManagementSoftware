import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrgPlan, canAccessFeature } from "@/lib/feature-gate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PerformanceSnapshot } from "@/types/database";

export const metadata = { title: "Benchmarks | PMPP" };

export default async function BenchmarksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const orgPlan = await getOrgPlan(supabase, orgId);
  if (!orgPlan || !canAccessFeature(orgPlan, "benchmark_access")) {
    redirect("/settings/billing?upgrade=benchmark_access");
  }

  // Get org's latest snapshot for comparison
  const { data: orgSnapshot } = await supabase
    .from("performance_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .is("property_id", null)
    .eq("period_type", "monthly")
    .order("period_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshot = orgSnapshot as PerformanceSnapshot | null;

  // Get org's properties to determine property types and states
  const { data: properties } = await supabase
    .from("properties")
    .select("property_type, state")
    .eq("organization_id", orgId)
    .is("deleted_at", null);

  // Get benchmark data for relevant segments
  const propertyTypes = [...new Set(properties?.map((p) => p.property_type) ?? [])];
  const states = [...new Set(properties?.map((p) => p.state) ?? [])];

  let benchmarks: Array<Record<string, unknown>> = [];
  if (propertyTypes.length > 0 && states.length > 0) {
    const { data } = await supabase
      .from("benchmark_data")
      .select("*")
      .in("property_type", propertyTypes)
      .in("state", states)
      .eq("period_type", "monthly")
      .order("period_date", { ascending: false })
      .limit(20);
    benchmarks = data ?? [];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Industry Benchmarks</h1>
      <p className="text-sm text-gray-500">
        Compare your portfolio performance against anonymous industry averages.
      </p>

      {/* Your Performance vs Benchmarks */}
      {snapshot && benchmarks.length > 0 ? (
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Your Portfolio vs Industry Average</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Metric</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Your Value</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Industry Avg</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Industry Median</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(() => {
                  const bench = benchmarks[0];
                  const metrics = [
                    { label: "Vacancy Rate", yours: snapshot.vacancy_rate, avg: bench.avg_vacancy_rate as number, median: bench.median_vacancy_rate as number, format: "pct", lowerBetter: true },
                    { label: "Avg Rent/Unit", yours: snapshot.avg_rent_per_unit, avg: bench.avg_rent_per_unit as number, median: bench.median_rent_per_unit as number, format: "currency", lowerBetter: false },
                    { label: "Collection Rate", yours: snapshot.rent_collection_rate, avg: bench.avg_rent_collection_rate as number, median: null, format: "pct", lowerBetter: false },
                    { label: "Expense Ratio", yours: snapshot.expense_ratio, avg: bench.avg_expense_ratio as number, median: null, format: "pct", lowerBetter: true },
                    { label: "Maintenance $/Unit", yours: snapshot.maintenance_cost_per_unit, avg: bench.avg_maintenance_cost_per_unit as number, median: null, format: "currency", lowerBetter: true },
                    { label: "Tenant Retention", yours: snapshot.tenant_retention_rate, avg: bench.avg_tenant_retention as number, median: null, format: "pct", lowerBetter: false },
                  ];

                  return metrics.map((m) => {
                    const yours = m.yours ?? 0;
                    const avg = m.avg ?? 0;
                    const better = m.lowerBetter ? yours < avg : yours > avg;
                    return (
                      <tr key={m.label}>
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">{m.label}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-sm">
                          {m.format === "pct" ? formatPercent(yours) : formatCurrency(yours)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-500">
                          {m.format === "pct" ? formatPercent(avg) : formatCurrency(avg)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-500">
                          {m.median != null ? (m.format === "pct" ? formatPercent(m.median) : formatCurrency(m.median)) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <Badge variant={better ? "success" : "warning"}>
                            {better ? "Above Avg" : "Below Avg"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No benchmark data available"
          description="Benchmark data is computed monthly. Check back after the next computation cycle."
        />
      )}

      {/* Benchmark Segments */}
      {benchmarks.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Available Benchmark Segments</h3>
          <div className="space-y-2">
            {benchmarks.map((b, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {(b.property_type as string).replace(/_/g, " ")} — {b.state as string}
                  </p>
                  <p className="text-xs text-gray-500">
                    {b.unit_count_bucket as string} units · {b.sample_size as number} contributors · {b.period_date as string}
                  </p>
                </div>
                <Badge variant="info">{b.period_type as string}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
