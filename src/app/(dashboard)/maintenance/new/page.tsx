import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getProperties } from "@/lib/queries";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MaintenanceRequestForm } from "@/components/forms/maintenance-request-form";

export const metadata = { title: "New Maintenance Request — PMPP" };

export default async function NewMaintenanceRequestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  const [propertiesRes, unitsRes] = await Promise.all([
    getProperties(supabase, orgId),
    supabase.from("units").select("id, unit_number").eq("organization_id", orgId).is("deleted_at", null).order("unit_number"),
  ]);

  const properties = (propertiesRes.data ?? []).map((p) => ({ id: p.id, label: p.name }));
  const units = (unitsRes.data ?? []).map((u) => ({ id: u.id, label: u.unit_number }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "New Request" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Submit Maintenance Request</h1>
      <MaintenanceRequestForm properties={properties} units={units} />
    </div>
  );
}
