import { PerformanceSnapshot, Property } from "@/types/database";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import Link from "next/link";

interface PropertyComparisonProps {
  properties: Pick<Property, "id" | "name" | "city" | "state">[];
  snapshots: PerformanceSnapshot[];
}

export function PropertyComparison({ properties, snapshots }: PropertyComparisonProps) {
  // Latest snapshot per property
  const snapshotByProperty = new Map<string, PerformanceSnapshot>();
  for (const snap of snapshots) {
    if (snap.property_id && !snapshotByProperty.has(snap.property_id)) {
      snapshotByProperty.set(snap.property_id, snap);
    }
  }

  if (properties.length === 0) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Property Comparison</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Property</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">NOI</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Vacancy</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Collection</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Units</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {properties.map((prop) => {
              const snap = snapshotByProperty.get(prop.id);
              return (
                <tr key={prop.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/properties/${prop.id}`} className="font-medium text-blue-600 hover:underline">
                      {prop.name}
                    </Link>
                    <p className="text-xs text-gray-500">{prop.city}, {prop.state}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(snap?.noi)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatPercent(snap?.vacancy_rate)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatPercent(snap?.rent_collection_rate)}</td>
                  <td className="px-4 py-3 text-right text-sm">{snap?.total_units ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
