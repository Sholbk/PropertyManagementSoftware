import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveLeases } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, daysUntil } from "@/lib/utils";

export const metadata = { title: "Leasing | PMPP" };

export default async function LeasingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const { data: leases } = await getActiveLeases(supabase, orgId);

  if (!leases || leases.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Leasing</h1>
        <EmptyState title="No active leases" description="Active leases will appear here." />
      </div>
    );
  }

  // Split into expiring and active
  const expiring = leases.filter((l) => {
    const days = daysUntil(l.end_date);
    return days !== null && days >= 0 && days <= 90;
  });
  const active = leases.filter((l) => !expiring.includes(l));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Leasing</h1>

      {/* Expiring Soon Alert */}
      {expiring.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <h3 className="mb-3 text-sm font-semibold text-yellow-800">
            Leases Expiring Within 90 Days ({expiring.length})
          </h3>
          <div className="space-y-2">
            {expiring.map((lease) => {
              const days = daysUntil(lease.end_date);
              const tenant = lease.tenants as unknown as { first_name: string; last_name: string } | null;
              const unit = lease.units as unknown as { unit_number: string } | null;
              const property = lease.properties as unknown as { name: string } | null;
              return (
                <div key={lease.id} className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {tenant ? `${tenant.first_name} ${tenant.last_name}` : "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {property?.name} — Unit {unit?.unit_number} — {formatCurrency(lease.monthly_rent)}/mo
                    </p>
                  </div>
                  <Badge variant={days !== null && days <= 30 ? "danger" : "warning"}>
                    {days} days
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* All Active Leases */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Active Leases ({leases.length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Tenant</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Property / Unit</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Rent</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leases.map((lease) => {
                const days = daysUntil(lease.end_date);
                const tenant = lease.tenants as unknown as { first_name: string; last_name: string } | null;
                const unit = lease.units as unknown as { unit_number: string } | null;
                const property = lease.properties as unknown as { name: string } | null;
                return (
                  <tr key={lease.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                      {tenant ? `${tenant.first_name} ${tenant.last_name}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                      {property?.name} — {unit?.unit_number}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm">{formatCurrency(lease.monthly_rent)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Badge variant={lease.status === "active" ? "success" : "info"}>{lease.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                      {lease.end_date ?? "M2M"} {days !== null && days <= 90 && (
                        <span className="text-red-500">({days}d)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
