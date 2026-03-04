import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TenantForm } from "@/components/forms/tenant-form";

export const metadata = { title: "Edit Tenant — PMPP" };

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase.from("tenants").select("*").eq("id", id).is("deleted_at", null).single();
  if (!tenant) notFound();

  const ec = tenant.emergency_contact as { name?: string; phone?: string } | null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[{ label: "Tenants", href: "/tenants" }, { label: `${tenant.first_name} ${tenant.last_name}`, href: `/tenants/${id}` }, { label: "Edit" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Edit Tenant</h1>
      <TenantForm
        mode="edit"
        initialData={{
          id: tenant.id,
          first_name: tenant.first_name,
          last_name: tenant.last_name,
          email: tenant.email ?? "",
          phone: tenant.phone ?? "",
          date_of_birth: tenant.date_of_birth ?? "",
          income_annual: tenant.income_annual?.toString() ?? "",
          employer: tenant.employer ?? "",
          emergency_contact_name: ec?.name ?? "",
          emergency_contact_phone: ec?.phone ?? "",
          notes: tenant.notes ?? "",
        }}
      />
    </div>
  );
}
