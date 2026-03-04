import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export const metadata = { title: "Inspections | PMPP" };

const typeLabels: Record<string, string> = {
  move_in: "Move-In",
  move_out: "Move-Out",
  routine: "Routine",
  safety: "Safety",
  annual: "Annual",
};

const statusVariant = (status: string) => {
  if (status === "passed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "in_progress") return "warning" as const;
  if (status === "needs_followup") return "warning" as const;
  return "neutral" as const;
};

export default async function InspectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  const { data: inspections } = await supabase
    .from("inspections")
    .select("id, inspection_type, status, scheduled_date, completed_date, overall_result, follow_up_required, properties(name), units(unit_number)")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("scheduled_date", { ascending: false })
    .limit(50);

  const rows = inspections ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
        <Link href="/inspections/new" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Schedule Inspection
        </Link>
      </div>

      {rows.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Property</th>
                <th className="pb-2 pr-4">Unit</th>
                <th className="pb-2 pr-4">Result</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((insp) => {
                const property = insp.properties as unknown as { name: string } | null;
                const unit = insp.units as unknown as { unit_number: string } | null;
                return (
                  <tr key={insp.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4">{insp.scheduled_date}</td>
                    <td className="py-2 pr-4">{typeLabels[insp.inspection_type] ?? insp.inspection_type}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/inspections/${insp.id}`} className="text-blue-600 hover:underline">
                        {property?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{unit?.unit_number ?? "All"}</td>
                    <td className="py-2 pr-4">
                      {insp.overall_result ? (
                        <Badge variant={insp.overall_result === "pass" ? "success" : insp.overall_result === "fail" ? "danger" : "warning"}>
                          {insp.overall_result}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {insp.follow_up_required && <Badge variant="warning">Follow-up</Badge>}
                        <Badge variant={statusVariant(insp.status)}>{insp.status.replace(/_/g, " ")}</Badge>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title="No inspections"
          description="Schedule your first inspection to track property conditions."
          action={<Link href="/inspections/new" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Schedule Inspection</Link>}
        />
      )}
    </div>
  );
}
