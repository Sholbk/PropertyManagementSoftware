import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getUnitById } from "@/lib/queries";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { UnitForm } from "@/components/forms/unit-form";

export const metadata = { title: "Edit Unit — PMPP" };

export default async function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: unit } = await getUnitById(supabase, id);
  if (!unit) notFound();

  // Get property name for breadcrumbs
  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", unit.property_id)
    .single();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs items={[
        { label: "Properties", href: "/properties" },
        { label: property?.name ?? "Property", href: `/properties/${unit.property_id}` },
        { label: `Unit ${unit.unit_number}` },
        { label: "Edit" },
      ]} />
      <h1 className="text-2xl font-bold text-gray-900">Edit Unit {unit.unit_number}</h1>
      <UnitForm
        propertyId={unit.property_id}
        mode="edit"
        backHref={`/properties/${unit.property_id}`}
        initialData={{
          id: unit.id,
          unit_number: unit.unit_number,
          bedrooms: unit.bedrooms?.toString() ?? "",
          bathrooms: unit.bathrooms?.toString() ?? "",
          sqft: unit.sqft?.toString() ?? "",
          market_rent: unit.market_rent?.toString() ?? "",
          status: unit.status,
          floor_number: unit.floor_number?.toString() ?? "",
          notes: unit.notes ?? "",
        }}
      />
    </div>
  );
}
