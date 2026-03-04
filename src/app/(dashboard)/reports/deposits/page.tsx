import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Deposit Tracking | PMPP" };

export default async function DepositsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  // Get all leases with deposit info
  const { data: leases } = await supabase
    .from("leases")
    .select("id, status, security_deposit, pet_deposit, start_date, end_date, tenants(first_name, last_name), units(unit_number), properties(name)")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .not("security_deposit", "is", null)
    .order("start_date", { ascending: false });

  const rows = leases ?? [];

  const totalDeposits = rows.reduce((s, l) => s + (l.security_deposit ?? 0) + (l.pet_deposit ?? 0), 0);
  const activeDeposits = rows
    .filter((l) => l.status === "active" || l.status === "month_to_month")
    .reduce((s, l) => s + (l.security_deposit ?? 0) + (l.pet_deposit ?? 0), 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Deposit Tracking" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Deposit Tracking</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Total Deposits Held</p>
          <p className="text-2xl font-bold">{formatCurrency(totalDeposits)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Active Lease Deposits</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(activeDeposits)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Leases with Deposits</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </Card>
      </div>

      {rows.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Tenant</th>
                <th className="pb-2 pr-4">Property / Unit</th>
                <th className="pb-2 pr-4">Lease Status</th>
                <th className="pb-2 pr-4 text-right">Security Deposit</th>
                <th className="pb-2 pr-4 text-right">Pet Deposit</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const tenant = l.tenants as unknown as { first_name: string; last_name: string } | null;
                const unit = l.units as unknown as { unit_number: string } | null;
                const property = l.properties as unknown as { name: string } | null;
                const total = (l.security_deposit ?? 0) + (l.pet_deposit ?? 0);
                return (
                  <tr key={l.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 font-medium">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "—"}</td>
                    <td className="py-2 pr-4">{property?.name ?? "—"} {unit ? `— ${unit.unit_number}` : ""}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={l.status === "active" || l.status === "month_to_month" ? "success" : l.status === "terminated" ? "danger" : "neutral"}>
                        {l.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-right">{l.security_deposit ? formatCurrency(l.security_deposit) : "—"}</td>
                    <td className="py-2 pr-4 text-right">{l.pet_deposit ? formatCurrency(l.pet_deposit) : "—"}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="No deposits tracked" description="Deposits will appear here when leases include security or pet deposits." />
      )}
    </div>
  );
}
