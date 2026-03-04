import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PropertyForm } from "@/components/forms/property-form";

export const metadata = { title: "Add Property — PMPP" };

export default async function NewPropertyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[
        { label: "Properties", href: "/properties" },
        { label: "Add Property" },
      ]} />
      <h1 className="text-2xl font-bold text-gray-900">Add Property</h1>
      <PropertyForm mode="create" />
    </div>
  );
}
