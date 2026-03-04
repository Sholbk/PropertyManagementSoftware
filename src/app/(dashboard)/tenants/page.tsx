import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export const metadata = { title: "Tenants | PMPP" };

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, first_name, last_name, email, phone, created_at")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("last_name");

  // Get active lease info for each tenant
  const { data: leases } = await supabase
    .from("leases")
    .select("tenant_id, status, monthly_rent, units(unit_number), properties(name)")
    .eq("organization_id", orgId)
    .in("status", ["active", "month_to_month"])
    .is("deleted_at", null);

  const leaseByTenant = new Map<string, { rent: number; unit: string; property: string }>();
  for (const lease of leases ?? []) {
    const unit = lease.units as unknown as { unit_number: string } | null;
    const property = lease.properties as unknown as { name: string } | null;
    leaseByTenant.set(lease.tenant_id, {
      rent: lease.monthly_rent,
      unit: unit?.unit_number ?? "",
      property: property?.name ?? "",
    });
  }

  if (!tenants || tenants.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <Link href="/tenants/new" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Add Tenant</Link>
        </div>
        <EmptyState title="No tenants yet" description="Add your first tenant to start managing leases." action={<Link href="/tenants/new" className="text-blue-600 hover:underline">Add your first tenant</Link>} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <Link href="/tenants/new" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Add Tenant</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tenants.map((tenant) => {
          const lease = leaseByTenant.get(tenant.id);
          return (
            <Link key={tenant.id} href={`/tenants/${tenant.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{tenant.first_name} {tenant.last_name}</h3>
                    {tenant.email && <p className="text-sm text-gray-500">{tenant.email}</p>}
                    {tenant.phone && <p className="text-sm text-gray-400">{tenant.phone}</p>}
                  </div>
                  <Badge variant={lease ? "success" : "neutral"}>{lease ? "Active Lease" : "No Lease"}</Badge>
                </div>
                {lease && (
                  <div className="mt-3 text-sm text-gray-500">
                    <p>{lease.property} — Unit {lease.unit}</p>
                    <p className="font-medium text-gray-700">${lease.rent.toLocaleString()}/mo</p>
                  </div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
