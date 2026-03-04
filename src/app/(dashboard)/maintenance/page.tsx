import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getWorkOrders, getMaintenanceRequests } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Maintenance | PMPP" };

const priorityVariant: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  emergency: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

const statusVariant: Record<string, "success" | "warning" | "info" | "danger" | "neutral"> = {
  open: "info",
  assigned: "info",
  in_progress: "warning",
  pending_parts: "warning",
  pending_vendor: "warning",
  completed: "success",
  verified: "success",
  closed: "neutral",
  cancelled: "neutral",
};

export default async function MaintenancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const [workOrdersRes, requestsRes] = await Promise.all([
    getWorkOrders(supabase, orgId),
    getMaintenanceRequests(supabase, orgId),
  ]);

  const workOrders = workOrdersRes.data ?? [];
  const requests = requestsRes.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
        <Link href="/maintenance/new" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">New Request</Link>
      </div>

      {/* Maintenance Requests */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Maintenance Requests ({requests.length})</h3>
        {requests.length > 0 ? (
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{req.title}</p>
                    {req.ai_category && (
                      <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                        AI: {req.ai_category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{req.category} — {formatRelativeDate(req.reported_at)}</p>
                  {req.ai_summary && <p className="mt-0.5 truncate text-xs text-gray-400">{req.ai_summary}</p>}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <Badge variant={priorityVariant[req.priority] ?? "neutral"}>{req.priority}</Badge>
                  <Badge variant={req.status === "resolved" || req.status === "closed" ? "success" : "warning"}>
                    {req.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No maintenance requests</p>
        )}
      </Card>

      {/* Work Orders */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Work Orders ({workOrders.length})</h3>
        {workOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Priority</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Cost</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {workOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">{wo.title}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">{wo.category}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Badge variant={priorityVariant[wo.priority] ?? "neutral"}>{wo.priority}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Badge variant={statusVariant[wo.status] ?? "neutral"}>{wo.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm">{formatCurrency(wo.total_cost)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">{formatRelativeDate(wo.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No work orders</p>
        )}
      </Card>
    </div>
  );
}
