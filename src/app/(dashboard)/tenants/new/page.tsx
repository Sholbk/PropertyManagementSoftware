import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TenantForm } from "@/components/forms/tenant-form";

export const metadata = { title: "Add Tenant — PMPP" };

export default async function NewTenantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.app_metadata?.active_org_id) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[{ label: "Tenants", href: "/tenants" }, { label: "Add Tenant" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Add Tenant</h1>
      <TenantForm mode="create" />
    </div>
  );
}
