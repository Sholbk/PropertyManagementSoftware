import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getProperties } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPropertyType } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Properties | PMPP" };

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const { data: properties } = await getProperties(supabase, orgId);

  // Get unit counts per property
  const { data: unitCounts } = await supabase
    .from("units")
    .select("property_id, status")
    .eq("organization_id", orgId)
    .is("deleted_at", null);

  const unitsByProperty = new Map<string, { total: number; vacant: number; occupied: number }>();
  for (const unit of unitCounts ?? []) {
    const entry = unitsByProperty.get(unit.property_id) ?? { total: 0, vacant: 0, occupied: 0 };
    entry.total++;
    if (unit.status === "vacant") entry.vacant++;
    if (unit.status === "occupied") entry.occupied++;
    unitsByProperty.set(unit.property_id, entry);
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
        <EmptyState title="No properties yet" description="Add your first property to get started." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Properties</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {properties.map((property) => {
          const units = unitsByProperty.get(property.id);
          return (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{property.name}</h3>
                    <p className="text-sm text-gray-500">{property.city}, {property.state}</p>
                  </div>
                  <Badge variant="info">{formatPropertyType(property.property_type)}</Badge>
                </div>
                {units && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{units.total} units</span>
                      <span className="text-gray-500">{units.vacant} vacant</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-red-200">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${units.total > 0 ? (units.occupied / units.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
                {property.year_built && (
                  <p className="mt-2 text-xs text-gray-400">Built {property.year_built}</p>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
