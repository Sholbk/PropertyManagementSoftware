import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Transactions | PMPP" };

const typeLabels: Record<string, string> = {
  rent_payment: "Rent Payment",
  late_fee: "Late Fee",
  security_deposit: "Security Deposit",
  pet_deposit: "Pet Deposit",
  pet_fee: "Pet Fee",
  parking_fee: "Parking Fee",
  utility_charge: "Utility",
  maintenance_expense: "Maintenance",
  vendor_payment: "Vendor Payment",
  insurance: "Insurance",
  tax: "Tax",
  management_fee: "Management Fee",
  capex: "CapEx",
  other_income: "Other Income",
  other_expense: "Other Expense",
};

const statusVariant = (status: string) => {
  if (status === "completed") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "failed" || status === "reversed") return "danger" as const;
  return "neutral" as const;
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  let query = supabase
    .from("financial_transactions")
    .select("id, type, amount, status, transaction_date, description, properties(name), tenants(first_name, last_name)")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .limit(200);

  if (params.type) query = query.eq("type", params.type);
  if (params.status) query = query.eq("status", params.status);

  const { data: transactions } = await query;
  const rows = transactions ?? [];

  // Compute totals
  const totalIncome = rows
    .filter((t) => t.amount > 0 && t.status === "completed")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = rows
    .filter((t) => t.amount < 0 && t.status === "completed")
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Financials", href: "/financials" }, { label: "Transactions" }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="flex gap-2">
          <a href="/api/export?entity=transactions" className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Export CSV
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Income (shown)</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Expenses (shown)</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Net (shown)</p>
          <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(totalIncome - totalExpenses)}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <form className="flex flex-wrap gap-3">
          <select name="type" defaultValue={params.type ?? ""} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">All Types</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Filter
          </button>
          {(params.type || params.status) && (
            <a href="/financials/transactions" className="inline-flex items-center px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
              Clear
            </a>
          )}
        </form>
      </Card>

      {/* Transaction Table */}
      {rows.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4">Property</th>
                <th className="pb-2 pr-4">Tenant</th>
                <th className="pb-2 pr-4 text-right">Amount</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const property = t.properties as unknown as { name: string } | null;
                const tenant = t.tenants as unknown as { first_name: string; last_name: string } | null;
                return (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4">{t.transaction_date}</td>
                    <td className="py-2 pr-4">{typeLabels[t.type] ?? t.type}</td>
                    <td className="py-2 pr-4 text-gray-500">{t.description ?? "—"}</td>
                    <td className="py-2 pr-4">{property?.name ?? "—"}</td>
                    <td className="py-2 pr-4">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "—"}</td>
                    <td className={`py-2 pr-4 text-right font-medium ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {t.amount >= 0 ? "+" : ""}{formatCurrency(Math.abs(t.amount))}
                    </td>
                    <td className="py-2 text-right">
                      <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="No transactions" description="Financial transactions will appear here as rent payments, expenses, and other financial activity are recorded." />
      )}
    </div>
  );
}
