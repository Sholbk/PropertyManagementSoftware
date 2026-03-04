import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { VendorForm } from "@/components/forms/vendor-form";

export const metadata = { title: "Add Vendor — PMPP" };

export default async function NewVendorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.app_metadata?.active_org_id) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Add Vendor" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Add Vendor</h1>
      <VendorForm mode="create" />
    </div>
  );
}
