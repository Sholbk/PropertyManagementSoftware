import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getUnitById, getActiveLeaseForUnit, getUnitMaintenanceHistory, getUnitTransactions } from "@/lib/queries";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRelativeDate, daysUntil } from "@/lib/utils";

const statusVariant: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  occupied: "success",
  vacant: "danger",
  maintenance: "warning",
  renovation: "info",
  off_market: "neutral",
};

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: unit } = await getUnitById(supabase, id);
  if (!unit) notFound();

  // Get property name for breadcrumbs
  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", unit.property_id)
    .single();

  const [leaseRes, maintenanceRes, transactionsRes] = await Promise.all([
    getActiveLeaseForUnit(supabase, id),
    getUnitMaintenanceHistory(supabase, id),
    getUnitTransactions(supabase, id),
  ]);

  const lease = leaseRes.data;
  const maintenance = maintenanceRes.data ?? [];
  const transactions = transactionsRes.data ?? [];
  const tenant = lease?.tenants as { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Properties", href: "/properties" },
        { label: property?.name ?? "Property", href: `/properties/${unit.property_id}` },
        { label: `Unit ${unit.unit_number}` },
      ]} />

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Unit {unit.unit_number}</h1>
        <Badge variant={statusVariant[unit.status] ?? "neutral"}>{unit.status}</Badge>
      </div>

      {/* Unit Details */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm text-gray-500">Bedrooms</p>
          <p className="text-lg font-semibold">{unit.bedrooms ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Bathrooms</p>
          <p className="text-lg font-semibold">{unit.bathrooms ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Sqft</p>
          <p className="text-lg font-semibold">{unit.sqft ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Market Rent</p>
          <p className="text-lg font-semibold">{formatCurrency(unit.market_rent)}</p>
        </Card>
      </div>

      {/* Active Lease */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Current Lease</h3>
        {lease ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">Tenant</p>
                <p className="text-sm font-medium">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Monthly Rent</p>
                <p className="text-sm font-medium">{formatCurrency(lease.monthly_rent)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Lease Dates</p>
                <p className="text-sm font-medium">{lease.start_date} — {lease.end_date ?? "M2M"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Expires In</p>
                <p className="text-sm font-medium">
                  {lease.end_date ? `${daysUntil(lease.end_date)} days` : "Month-to-month"}
                </p>
              </div>
            </div>
            {tenant?.email && <p className="text-xs text-gray-400">{tenant.email} | {tenant.phone}</p>}
            {unit.market_rent && lease.monthly_rent && (
              <p className="text-xs text-gray-500">
                Rent vs market: {((lease.monthly_rent / unit.market_rent - 1) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No active lease</p>
        )}
      </Card>

      {/* Maintenance History */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Maintenance History</h3>
        {maintenance.length > 0 ? (
          <div className="space-y-2">
            {maintenance.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{req.title}</p>
                  <p className="text-xs text-gray-500">{req.category} — {formatRelativeDate(req.reported_at)}</p>
                </div>
                <Badge variant={req.status === "resolved" || req.status === "closed" ? "success" : "warning"}>
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No maintenance history</p>
        )}
      </Card>

      {/* Payment History */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Payment History</h3>
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">{txn.transaction_date}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">{txn.type.replace(/_/g, " ")}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm">{formatCurrency(txn.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">
                      <Badge variant={txn.status === "completed" ? "success" : txn.status === "pending" ? "warning" : "danger"}>
                        {txn.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No transactions</p>
        )}
      </Card>
    </div>
  );
}
