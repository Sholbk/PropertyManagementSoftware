import { createClient } from "@/lib/supabase/server";

interface PropertyRow {
  id: string;
  name: string;
  property_type: string;
  city: string;
  state: string;
  total_units: number;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch portfolio summary metrics
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, property_type, city, state, total_units")
    .is("deleted_at", null)
    .order("name");

  const properties = data as PropertyRow[] | null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Portfolio Overview
      </h2>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Connection error</p>
          <p className="text-sm mt-1">{error.message}</p>
          <p className="text-sm mt-2">
            Make sure your Supabase schema has been applied and env vars are set.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Properties"
            value={properties?.length ?? 0}
          />
          <MetricCard
            label="Total Units"
            value={
              properties?.reduce((sum, p) => sum + (p.total_units ?? 0), 0) ?? 0
            }
          />
          <MetricCard label="Vacancy Rate" value="—" subtitle="Run schema first" />
          <MetricCard label="NOI" value="—" subtitle="Run schema first" />
        </div>
      )}

      {properties && properties.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Properties</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Units
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {properties.map((property) => (
                <tr key={property.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {property.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {property.property_type.replace("_", " ")}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {property.city}, {property.state}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {property.total_units}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {properties && properties.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No properties yet. Schema is connected!</p>
          <p className="text-sm text-gray-400 mt-2">
            Add properties via the Supabase dashboard or API.
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
