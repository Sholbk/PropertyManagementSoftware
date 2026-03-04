import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Profit & Loss | PMPP" };

export default async function ProfitLossPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  // Get latest portfolio snapshot for P&L data
  const { data: snapshots } = await supabase
    .from("performance_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .is("property_id", null)
    .eq("period_type", "monthly")
    .order("period_date", { ascending: false })
    .limit(12);

  const rows = snapshots ?? [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Profit & Loss" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>

      {rows.length === 0 ? (
        <Card><p className="text-sm text-gray-400">No data available yet. P&L data is generated from monthly performance snapshots.</p></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Period</th>
                <th className="pb-2 pr-4 text-right">Gross Potential Rent</th>
                <th className="pb-2 pr-4 text-right">Vacancy Loss</th>
                <th className="pb-2 pr-4 text-right">Effective Income</th>
                <th className="pb-2 pr-4 text-right">Operating Expenses</th>
                <th className="pb-2 pr-4 text-right">Maintenance</th>
                <th className="pb-2 pr-4 text-right">NOI</th>
                <th className="pb-2 text-right">Expense Ratio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((snap) => (
                <tr key={snap.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">{snap.period_date}</td>
                  <td className="py-2 pr-4 text-right">{snap.gross_potential_rent ? formatCurrency(snap.gross_potential_rent) : "—"}</td>
                  <td className="py-2 pr-4 text-right text-red-600">{snap.vacancy_loss ? formatCurrency(snap.vacancy_loss) : "—"}</td>
                  <td className="py-2 pr-4 text-right">{snap.effective_gross_income ? formatCurrency(snap.effective_gross_income) : "—"}</td>
                  <td className="py-2 pr-4 text-right text-red-600">{snap.operating_expenses ? formatCurrency(snap.operating_expenses) : "—"}</td>
                  <td className="py-2 pr-4 text-right text-red-600">{snap.maintenance_costs ? formatCurrency(snap.maintenance_costs) : "—"}</td>
                  <td className={`py-2 pr-4 text-right font-medium ${(snap.noi ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {snap.noi ? formatCurrency(snap.noi) : "—"}
                  </td>
                  <td className="py-2 text-right">{snap.expense_ratio ? `${(snap.expense_ratio * 100).toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
