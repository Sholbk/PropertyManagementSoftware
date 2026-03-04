import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { WorkOrderActions } from "@/components/maintenance/work-order-actions";
import Link from "next/link";

const priorityVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  emergency: "danger",
};

export const metadata = { title: "Maintenance Request | PMPP" };

export default async function MaintenanceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("*, properties(name), units(unit_number), tenants(first_name, last_name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!request) notFound();

  const property = request.properties as unknown as { name: string } | null;
  const unit = request.units as unknown as { unit_number: string } | null;
  const tenant = request.tenants as unknown as { first_name: string; last_name: string } | null;

  // Get related work orders
  const { data: workOrders } = await supabase
    .from("work_orders")
    .select("id, title, status, priority, vendor_id, assigned_to, created_at, completed_at, total_cost")
    .eq("maintenance_request_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Get vendors for work order creation
  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, company_name, specialties")
    .eq("organization_id", request.organization_id)
    .is("deleted_at", null)
    .order("company_name");

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: request.title }]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
          <Badge variant={priorityVariant[request.priority] ?? "neutral"}>{request.priority}</Badge>
          <Badge variant={request.status === "resolved" ? "success" : request.status === "new" ? "danger" : "warning"}>{request.status.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Details</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Property</dt><dd>{property?.name}</dd></div>
            {unit && <div><dt className="text-gray-500">Unit</dt><dd>{unit.unit_number}</dd></div>}
            {tenant && <div><dt className="text-gray-500">Reported by</dt><dd>{tenant.first_name} {tenant.last_name}</dd></div>}
            <div><dt className="text-gray-500">Category</dt><dd className="capitalize">{request.category}</dd></div>
            <div><dt className="text-gray-500">Reported</dt><dd>{new Date(request.reported_at).toLocaleDateString()}</dd></div>
            {request.entry_permitted !== null && (
              <div><dt className="text-gray-500">Entry permitted</dt><dd>{request.entry_permitted ? "Yes" : "No"}</dd></div>
            )}
            {request.entry_notes && <div><dt className="text-gray-500">Entry notes</dt><dd>{request.entry_notes}</dd></div>}
          </dl>
          {request.description && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700">Description</h4>
              <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{request.description}</p>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">AI Triage</h3>
          {request.ai_summary ? (
            <dl className="space-y-2 text-sm">
              {request.ai_category && <div><dt className="text-gray-500">AI Category</dt><dd><Badge variant="info">{request.ai_category}</Badge></dd></div>}
              {request.ai_priority_score !== null && <div><dt className="text-gray-500">Priority Score</dt><dd>{(request.ai_priority_score * 100).toFixed(0)}%</dd></div>}
              <div><dt className="text-gray-500">Summary</dt><dd>{request.ai_summary}</dd></div>
            </dl>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              AI analyzing...
            </div>
          )}
        </Card>
      </div>

      {/* Work Orders */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Work Orders ({workOrders?.length ?? 0})</h3>
          <WorkOrderActions
            requestId={id}
            requestTitle={request.title}
            propertyId={request.property_id}
            unitId={request.unit_id}
            category={request.category}
            priority={request.priority}
            vendors={(vendors ?? []).map((v) => ({ id: v.id, label: v.company_name }))}
          />
        </div>
        {workOrders && workOrders.length > 0 ? (
          <div className="space-y-2">
            {workOrders.map((wo) => (
              <Link key={wo.id} href={`/maintenance/work-orders/${wo.id}`} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{wo.title}</p>
                  <p className="text-xs text-gray-500">{new Date(wo.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={wo.status === "completed" || wo.status === "verified" ? "success" : wo.status === "in_progress" ? "info" : "warning"}>{wo.status.replace(/_/g, " ")}</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No work orders created yet</p>
        )}
      </Card>
    </div>
  );
}
