import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortfolioSnapshots } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendSpark } from "@/components/dashboard/trend-spark";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Financials | PMPP" };

export default async function FinancialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const { data: snapshots } = await getPortfolioSnapshots(supabase, orgId, 12);
  const sorted = [...(snapshots ?? [])].reverse();
  const current = snapshots?.[0];
  const previous = snapshots?.[1];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Financials</h1>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Net Operating Income" value={current?.noi} previousValue={previous?.noi} format="currency" />
        <MetricCard label="Gross Revenue" value={current?.effective_gross_income} previousValue={previous?.effective_gross_income} format="currency" />
        <MetricCard label="Operating Expenses" value={current?.operating_expenses} previousValue={previous?.operating_expenses} format="currency" invertTrend />
        <MetricCard label="Expense Ratio" value={current?.expense_ratio} previousValue={previous?.expense_ratio} format="percent" invertTrend />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Rent Collection" value={current?.rent_collection_rate} previousValue={previous?.rent_collection_rate} format="percent" />
        <MetricCard label="Delinquent Amount" value={current?.delinquent_amount} previousValue={previous?.delinquent_amount} format="currency" invertTrend />
        <MetricCard label="Vacancy Loss" value={current?.vacancy_loss} previousValue={previous?.vacancy_loss} format="currency" invertTrend />
        <MetricCard label="Maintenance Costs" value={current?.maintenance_costs} previousValue={previous?.maintenance_costs} format="currency" invertTrend />
      </div>

      {/* NOI Trend */}
      {sorted.length > 1 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">NOI Trend (Last {sorted.length} Months)</h3>
          <TrendSpark data={sorted.map((s) => s.noi)} width={600} height={60} />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 sm:grid-cols-4 md:grid-cols-6">
            {sorted.map((s) => (
              <div key={s.period_date} className="flex justify-between">
                <span>{s.period_date}</span>
                <span className="font-medium text-gray-700">{formatCurrency(s.noi)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Revenue Breakdown */}
      {current && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Current Period Breakdown</h3>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-gray-500">Gross Potential Rent</p>
              <p className="font-medium">{formatCurrency(current.gross_potential_rent)}</p>
            </div>
            <div>
              <p className="text-gray-500">Effective Gross Income</p>
              <p className="font-medium">{formatCurrency(current.effective_gross_income)}</p>
            </div>
            <div>
              <p className="text-gray-500">Other Income</p>
              <p className="font-medium">{formatCurrency(current.other_income)}</p>
            </div>
            <div>
              <p className="text-gray-500">Maintenance</p>
              <p className="font-medium">{formatCurrency(current.maintenance_costs)}</p>
            </div>
            <div>
              <p className="text-gray-500">Management Fees</p>
              <p className="font-medium">{formatCurrency(current.management_fees)}</p>
            </div>
            <div>
              <p className="text-gray-500">CapEx</p>
              <p className="font-medium">{formatCurrency(current.capex)}</p>
            </div>
          </div>
        </Card>
      )}

      {(!snapshots || snapshots.length === 0) && (
        <EmptyState title="No financial data" description="Financial snapshots will appear once the compute-metrics function runs." />
      )}
    </div>
  );
}
