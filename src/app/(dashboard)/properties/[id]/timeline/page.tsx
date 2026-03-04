import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export const metadata = { title: "Property Timeline | PMPP" };

export default async function PropertyTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  // Get property
  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (!property) redirect("/properties");

  // Gather events from multiple sources in parallel
  const [{ data: maintenanceRequests }, { data: inspections }, { data: leases }, { data: transactions }] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, reported_at, resolved_at")
      .eq("property_id", id)
      .is("deleted_at", null)
      .order("reported_at", { ascending: false })
      .limit(20),
    supabase
      .from("inspections")
      .select("id, inspection_type, status, scheduled_date, completed_date, overall_result")
      .eq("property_id", id)
      .is("deleted_at", null)
      .order("scheduled_date", { ascending: false })
      .limit(20),
    supabase
      .from("leases")
      .select("id, status, start_date, end_date, tenants(first_name, last_name)")
      .eq("property_id", id)
      .is("deleted_at", null)
      .order("start_date", { ascending: false })
      .limit(20),
    supabase
      .from("financial_transactions")
      .select("id, type, amount, status, transaction_date, description")
      .eq("property_id", id)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .limit(20),
  ]);

  // Merge into unified timeline
  interface TimelineEvent {
    date: string;
    type: string;
    category: "maintenance" | "inspection" | "lease" | "financial";
    title: string;
    detail: string;
    status?: string;
  }

  const events: TimelineEvent[] = [];

  for (const r of maintenanceRequests ?? []) {
    events.push({
      date: r.reported_at,
      type: "Maintenance Request",
      category: "maintenance",
      title: r.title,
      detail: `${r.priority} priority — ${r.status}`,
      status: r.status,
    });
  }

  for (const i of inspections ?? []) {
    events.push({
      date: i.scheduled_date,
      type: `${(i.inspection_type as string).replace(/_/g, " ")} Inspection`,
      category: "inspection",
      title: `${(i.inspection_type as string).replace(/_/g, " ")} inspection`,
      detail: i.overall_result ? `Result: ${i.overall_result}` : i.status.replace(/_/g, " "),
      status: i.status,
    });
  }

  for (const l of leases ?? []) {
    const tenant = l.tenants as unknown as { first_name: string; last_name: string } | null;
    events.push({
      date: l.start_date,
      type: "Lease",
      category: "lease",
      title: `Lease ${l.status}`,
      detail: tenant ? `${tenant.first_name} ${tenant.last_name} — ${l.start_date} to ${l.end_date ?? "ongoing"}` : "",
      status: l.status,
    });
  }

  for (const t of transactions ?? []) {
    events.push({
      date: t.transaction_date,
      type: t.type.replace(/_/g, " "),
      category: "financial",
      title: t.description ?? t.type.replace(/_/g, " "),
      detail: `$${Math.abs(t.amount).toLocaleString()} — ${t.status}`,
      status: t.status,
    });
  }

  // Sort by date descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const categoryColor: Record<string, string> = {
    maintenance: "bg-orange-100 text-orange-700",
    inspection: "bg-purple-100 text-purple-700",
    lease: "bg-blue-100 text-blue-700",
    financial: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Properties", href: "/properties" }, { label: property.name, href: `/properties/${property.id}` }, { label: "Timeline" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Activity Timeline</h1>

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event, i) => (
            <Card key={`${event.category}-${i}`}>
              <div className="flex items-start gap-4">
                <div className="shrink-0 pt-0.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor[event.category]}`}>
                    {event.type}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-400">{event.date}</p>
                  {event.status && <Badge variant="neutral">{event.status.replace(/_/g, " ")}</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><p className="py-8 text-center text-sm text-gray-400">No activity recorded for this property</p></Card>
      )}
    </div>
  );
}
