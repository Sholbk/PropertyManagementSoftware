import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Payments | Tenant Portal | PMPP" };

export default async function TenantPaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Tenant profile not found. Please contact your property manager.</p>
      </div>
    );
  }

  // Get active lease for rent info
  const { data: lease } = await supabase
    .from("leases")
    .select("id, monthly_rent, rent_due_day, status")
    .eq("tenant_id", tenant.id)
    .in("status", ["active", "month_to_month"])
    .is("deleted_at", null)
    .maybeSingle();

  // Get payment history
  const { data: payments } = await supabase
    .from("financial_transactions")
    .select("id, amount, transaction_date, status, type, description")
    .eq("tenant_id", tenant.id)
    .in("type", ["rent_payment", "late_fee", "security_deposit", "pet_deposit", "utility_charge"])
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .limit(50);

  const allPayments = payments ?? [];

  // Calculate balance summary
  const totalPaid = allPayments
    .filter((p) => p.status === "completed" && p.type === "rent_payment")
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);

  const totalFees = allPayments
    .filter((p) => p.status === "completed" && p.type === "late_fee")
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);

  const pendingPayments = allPayments.filter((p) => p.status === "pending");

  const typeLabels: Record<string, string> = {
    rent_payment: "Rent Payment",
    late_fee: "Late Fee",
    security_deposit: "Security Deposit",
    pet_deposit: "Pet Deposit",
    utility_charge: "Utility Charge",
  };

  const statusVariant = (status: string) => {
    if (status === "completed") return "success" as const;
    if (status === "pending") return "warning" as const;
    if (status === "failed" || status === "reversed") return "danger" as const;
    return "neutral" as const;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Payments</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Monthly Rent</p>
          <p className="text-2xl font-bold">{lease ? formatCurrency(lease.monthly_rent) : "—"}</p>
          {lease && (
            <p className="text-xs text-gray-400">
              Due on the {lease.rent_due_day}{lease.rent_due_day === 1 ? "st" : lease.rent_due_day === 2 ? "nd" : lease.rent_due_day === 3 ? "rd" : "th"} of each month
            </p>
          )}
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Paid (Rent)</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">
            {pendingPayments.length > 0
              ? formatCurrency(pendingPayments.reduce((s, p) => s + Math.abs(p.amount), 0))
              : formatCurrency(0)}
          </p>
          {totalFees > 0 && (
            <p className="text-xs text-red-500">Late fees: {formatCurrency(totalFees)}</p>
          )}
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Payment History</h3>
        {allPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4 text-right">Amount</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {allPayments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4">{p.transaction_date}</td>
                    <td className="py-2 pr-4">{typeLabels[p.type] ?? p.type}</td>
                    <td className="py-2 pr-4 text-gray-500">{p.description ?? "—"}</td>
                    <td className="py-2 pr-4 text-right font-medium">{formatCurrency(Math.abs(p.amount))}</td>
                    <td className="py-2 text-right">
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No payment records found</p>
        )}
      </Card>
    </div>
  );
}
