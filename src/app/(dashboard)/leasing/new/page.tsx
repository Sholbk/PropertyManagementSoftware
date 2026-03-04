import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getProperties } from "@/lib/queries";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LeaseForm } from "@/components/forms/lease-form";

export const metadata = { title: "New Lease — PMPP" };

export default async function NewLeasePage({ searchParams }: { searchParams: Promise<{ tenant_id?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  const [propertiesRes, unitsRes, tenantsRes] = await Promise.all([
    getProperties(supabase, orgId),
    supabase.from("units").select("id, unit_number, property_id").eq("organization_id", orgId).is("deleted_at", null).order("unit_number"),
    supabase.from("tenants").select("id, first_name, last_name").eq("organization_id", orgId).is("deleted_at", null).order("last_name"),
  ]);

  const properties = (propertiesRes.data ?? []).map((p) => ({ id: p.id, label: p.name }));
  const units = (unitsRes.data ?? []).map((u) => ({ id: u.id, label: u.unit_number }));
  const tenants = (tenantsRes.data ?? []).map((t) => ({ id: t.id, label: `${t.first_name} ${t.last_name}` }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[{ label: "Leasing", href: "/leasing" }, { label: "New Lease" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Create Lease</h1>
      <LeaseForm
        mode="create"
        properties={properties}
        units={units}
        tenants={tenants}
        initialData={params.tenant_id ? { tenant_id: params.tenant_id } : undefined}
      />
    </div>
  );
}
