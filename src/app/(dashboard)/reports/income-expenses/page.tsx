import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Income & Expenses | PMPP" };

export default async function IncomeExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  // Get transactions for the current year
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const { data: transactions } = await supabase
    .from("financial_transactions")
    .select("type, amount, status, transaction_date, properties(name)")
    .eq("organization_id", orgId)
    .gte("transaction_date", yearStart)
    .eq("status", "completed")
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false });

  const rows = transactions ?? [];

  const incomeTypes = ["rent_payment", "late_fee", "pet_fee", "parking_fee", "other_income"];
  const expenseTypes = ["maintenance_expense", "vendor_payment", "insurance", "tax", "management_fee", "capex", "utility_charge", "other_expense"];

  const income = rows.filter((t) => incomeTypes.includes(t.type));
  const expenses = rows.filter((t) => expenseTypes.includes(t.type));

  const totalIncome = income.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const netIncome = totalIncome - totalExpenses;

  // Group by type
  const incomeByType = new Map<string, number>();
  for (const t of income) {
    incomeByType.set(t.type, (incomeByType.get(t.type) ?? 0) + Math.abs(t.amount));
  }
  const expenseByType = new Map<string, number>();
  for (const t of expenses) {
    expenseByType.set(t.type, (expenseByType.get(t.type) ?? 0) + Math.abs(t.amount));
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Income & Expenses" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Income & Expenses — {new Date().getFullYear()}</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500">Total Income</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p></Card>
        <Card><p className="text-sm text-gray-500">Total Expenses</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p></Card>
        <Card><p className="text-sm text-gray-500">Net Income</p><p className={`text-2xl font-bold ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(netIncome)}</p></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Income Breakdown</h3>
          {incomeByType.size > 0 ? (
            <div className="space-y-2">
              {Array.from(incomeByType.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([type, amount]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-gray-600 capitalize">{type.replace(/_/g, " ")}</span>
                    <span className="font-medium text-green-600">{formatCurrency(amount)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No income recorded</p>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Expense Breakdown</h3>
          {expenseByType.size > 0 ? (
            <div className="space-y-2">
              {Array.from(expenseByType.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([type, amount]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-gray-600 capitalize">{type.replace(/_/g, " ")}</span>
                    <span className="font-medium text-red-600">{formatCurrency(amount)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No expenses recorded</p>
          )}
        </Card>
      </div>
    </div>
  );
}
