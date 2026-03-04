import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getPropertyById } from "@/lib/queries";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PropertyForm } from "@/components/forms/property-form";

export const metadata = { title: "Edit Property — PMPP" };

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await getPropertyById(supabase, id);
  if (!property) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[
        { label: "Properties", href: "/properties" },
        { label: property.name, href: `/properties/${id}` },
        { label: "Edit" },
      ]} />
      <h1 className="text-2xl font-bold text-gray-900">Edit Property</h1>
      <PropertyForm
        mode="edit"
        initialData={{
          id: property.id,
          name: property.name,
          property_type: property.property_type,
          address_line1: property.address_line1,
          address_line2: property.address_line2 ?? "",
          city: property.city,
          state: property.state,
          zip: property.zip,
          year_built: property.year_built?.toString() ?? "",
          total_sqft: property.total_sqft?.toString() ?? "",
        }}
      />
    </div>
  );
}
