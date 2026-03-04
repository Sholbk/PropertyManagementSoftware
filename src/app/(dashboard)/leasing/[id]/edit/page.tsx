import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getProperties } from "@/lib/queries";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LeaseForm } from "@/components/forms/lease-form";

export const metadata = { title: "Edit Lease — PMPP" };

export default async function EditLeasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  const { data: lease } = await supabase.from("leases").select("*").eq("id", id).is("deleted_at", null).single();
  if (!lease) notFound();

  const [propertiesRes, unitsRes, tenantsRes] = await Promise.all([
    getProperties(supabase, orgId),
    supabase.from("units").select("id, unit_number").eq("organization_id", orgId).is("deleted_at", null).order("unit_number"),
    supabase.from("tenants").select("id, first_name, last_name").eq("organization_id", orgId).is("deleted_at", null).order("last_name"),
  ]);

  const properties = (propertiesRes.data ?? []).map((p) => ({ id: p.id, label: p.name }));
  const units = (unitsRes.data ?? []).map((u) => ({ id: u.id, label: u.unit_number }));
  const tenants = (tenantsRes.data ?? []).map((t) => ({ id: t.id, label: `${t.first_name} ${t.last_name}` }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[{ label: "Leasing", href: "/leasing" }, { label: "Edit Lease" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Edit Lease</h1>
      <LeaseForm
        mode="edit"
        properties={properties}
        units={units}
        tenants={tenants}
        initialData={{
          id: lease.id,
          property_id: lease.property_id,
          unit_id: lease.unit_id,
          tenant_id: lease.tenant_id,
          lease_type: lease.lease_type,
          status: lease.status,
          start_date: lease.start_date,
          end_date: lease.end_date ?? "",
          monthly_rent: lease.monthly_rent.toString(),
          security_deposit: lease.security_deposit?.toString() ?? "",
          pet_deposit: lease.pet_deposit?.toString() ?? "",
          rent_due_day: lease.rent_due_day.toString(),
          late_fee_amount: lease.late_fee_amount?.toString() ?? "",
          late_fee_grace_days: lease.late_fee_grace_days?.toString() ?? "",
          escalation_pct: lease.escalation_pct?.toString() ?? "",
          move_in_date: lease.move_in_date ?? "",
        }}
      />
    </div>
  );
}
