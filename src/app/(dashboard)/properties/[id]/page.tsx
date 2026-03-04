import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getPropertyById, getPropertySnapshots, getUnitsForProperty, getOpenWorkOrders, getActiveLeases } from "@/lib/queries";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { VacancyBar } from "@/components/dashboard/vacancy-bar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPropertyType, daysUntil } from "@/lib/utils";
import Link from "next/link";

const unitStatusVariant: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  occupied: "success",
  vacant: "danger",
  maintenance: "warning",
  renovation: "info",
  off_market: "neutral",
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await getPropertyById(supabase, id);
  if (!property) notFound();

  const orgId = property.organization_id;

  const [snapshotsRes, unitsRes, workOrdersRes, leasesRes] = await Promise.all([
    getPropertySnapshots(supabase, orgId, id),
    getUnitsForProperty(supabase, id),
    getOpenWorkOrders(supabase, orgId, id),
    getActiveLeases(supabase, orgId, id),
  ]);

  const snapshots = snapshotsRes.data ?? [];
  const units = unitsRes.data ?? [];
  const workOrders = workOrdersRes.data ?? [];
  const leases = leasesRes.data ?? [];

  const occupied = units.filter((u) => u.status === "occupied").length;
  const vacant = units.filter((u) => u.status === "vacant").length;

  // Expiring leases (within 90 days)
  const expiringLeases = leases.filter((l) => {
    const days = daysUntil(l.end_date);
    return days !== null && days >= 0 && days <= 90;
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Properties", href: "/properties" },
        { label: property.name },
      ]} />

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
        <Badge variant="info">{formatPropertyType(property.property_type)}</Badge>
      </div>
      <p className="text-sm text-gray-500">
        {property.address_line1}, {property.city}, {property.state} {property.zip}
      </p>

      {/* Property KPIs */}
      <KpiGrid snapshots={snapshots} openWorkOrders={workOrders.length} />

      {/* Unit Occupancy */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Units ({units.length})</h3>
        <VacancyBar occupied={occupied} vacant={vacant} total={units.length} className="mb-4" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {units.map((unit) => (
            <Link
              key={unit.id}
              href={`/units/${unit.id}`}
              className="flex flex-col items-center rounded-md border border-gray-200 p-3 text-center transition-colors hover:bg-gray-50"
            >
              <span className="text-sm font-medium">{unit.unit_number}</span>
              <Badge variant={unitStatusVariant[unit.status] ?? "neutral"} className="mt-1">
                {unit.status}
              </Badge>
              {unit.market_rent && (
                <span className="mt-1 text-xs text-gray-400">{formatCurrency(unit.market_rent)}</span>
              )}
            </Link>
          ))}
        </div>
      </Card>

      {/* Open Work Orders */}
      {workOrders.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Open Work Orders ({workOrders.length})</h3>
          <div className="space-y-2">
            {workOrders.slice(0, 5).map((wo) => (
              <div key={wo.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{wo.title}</p>
                  <p className="text-xs text-gray-500">{wo.category}</p>
                </div>
                <Badge variant={wo.priority === "emergency" ? "danger" : wo.priority === "high" ? "warning" : "neutral"}>
                  {wo.priority}
                </Badge>
              </div>
            ))}
            {workOrders.length > 5 && (
              <Link href="/maintenance" className="block text-center text-sm text-blue-600 hover:underline">
                View all {workOrders.length} work orders
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* Expiring Leases */}
      {expiringLeases.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Leases Expiring Soon ({expiringLeases.length})</h3>
          <div className="space-y-2">
            {expiringLeases.map((lease) => {
              const days = daysUntil(lease.end_date);
              const tenant = lease.tenants as unknown as { first_name: string; last_name: string } | null;
              const unit = lease.units as unknown as { unit_number: string } | null;
              return (
                <div key={lease.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {tenant ? `${tenant.first_name} ${tenant.last_name}` : "Unknown"} — Unit {unit?.unit_number}
                    </p>
                    <p className="text-xs text-gray-500">{formatCurrency(lease.monthly_rent)}/mo</p>
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
    </div>
  );
}
