import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getPropertyById } from "@/lib/queries";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { UnitForm } from "@/components/forms/unit-form";

export const metadata = { title: "Add Unit — PMPP" };

export default async function NewUnitPage({ params }: { params: Promise<{ id: string }> }) {
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
        { label: "Add Unit" },
      ]} />
      <h1 className="text-2xl font-bold text-gray-900">Add Unit</h1>
      <UnitForm propertyId={id} mode="create" backHref={`/properties/${id}`} />
    </div>
  );
}
