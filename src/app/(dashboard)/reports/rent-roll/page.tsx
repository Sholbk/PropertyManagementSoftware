import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatCurrency, daysUntil } from "@/lib/utils";

export const metadata = { title: "Rent Roll | PMPP" };

export default async function RentRollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  // Get all active leases with tenant, unit, property info
  const { data: leases } = await supabase
    .from("leases")
    .select("id, monthly_rent, start_date, end_date, status, rent_due_day, security_deposit, tenants(first_name, last_name), units(unit_number, market_rent, sqft), properties(name)")
    .eq("organization_id", orgId)
    .in("status", ["active", "month_to_month"])
    .is("deleted_at", null)
    .order("properties(name)", { ascending: true });

  const rows = leases ?? [];
  const totalRent = rows.reduce((sum, l) => sum + l.monthly_rent, 0);
  const totalMarket = rows.reduce((sum, l) => {
    const unit = l.units as unknown as { market_rent: number | null } | null;
    return sum + (unit?.market_rent ?? l.monthly_rent);
  }, 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Rent Roll" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Rent Roll</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500">Active Leases</p><p className="text-2xl font-bold">{rows.length}</p></Card>
        <Card><p className="text-sm text-gray-500">Total Monthly Rent</p><p className="text-2xl font-bold">{formatCurrency(totalRent)}</p></Card>
        <Card><p className="text-sm text-gray-500">Total Market Rent</p><p className="text-2xl font-bold">{formatCurrency(totalMarket)}</p></Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Property</th>
              <th className="pb-2 pr-4">Unit</th>
              <th className="pb-2 pr-4">Tenant</th>
              <th className="pb-2 pr-4 text-right">Rent</th>
              <th className="pb-2 pr-4 text-right">Market</th>
              <th className="pb-2 pr-4">Lease End</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lease) => {
              const tenant = lease.tenants as unknown as { first_name: string; last_name: string } | null;
              const unit = lease.units as unknown as { unit_number: string; market_rent: number | null; sqft: number | null } | null;
              const property = lease.properties as unknown as { name: string } | null;
              const days = lease.end_date ? daysUntil(lease.end_date) : null;
              const belowMarket = unit?.market_rent && lease.monthly_rent < unit.market_rent;

              return (
                <tr key={lease.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">{property?.name}</td>
                  <td className="py-2 pr-4">{unit?.unit_number}</td>
                  <td className="py-2 pr-4">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "—"}</td>
                  <td className={`py-2 pr-4 text-right ${belowMarket ? "text-red-600" : ""}`}>{formatCurrency(lease.monthly_rent)}</td>
                  <td className="py-2 pr-4 text-right text-gray-500">{unit?.market_rent ? formatCurrency(unit.market_rent) : "—"}</td>
                  <td className="py-2 pr-4">{lease.end_date ?? "MTM"}</td>
                  <td className="py-2">
                    {days !== null && days <= 90 && days >= 0 ? (
                      <Badge variant="warning">{days}d</Badge>
                    ) : (
                      <Badge variant="success">{lease.status}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
