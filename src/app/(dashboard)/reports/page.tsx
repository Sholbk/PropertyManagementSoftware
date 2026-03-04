import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrgPlan, canAccessFeature } from "@/lib/feature-gate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export const metadata = { title: "Owner Reports | PMPP" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const orgPlan = await getOrgPlan(supabase, orgId);
  if (!orgPlan || !canAccessFeature(orgPlan, "owner_reporting")) {
    redirect("/settings/billing?upgrade=owner_reporting");
  }

  // Fetch report configs
  const { data: configs } = await supabase
    .from("owner_report_configs")
    .select("id, property_id, report_type, recipients, is_active, last_sent_at, next_send_date, properties(name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  // Fetch recent generated reports
  const { data: reports } = await supabase
    .from("owner_reports")
    .select("id, period_type, period_date, report_url, sent_at, properties(name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Owner Reports</h1>
      </div>

      {/* Report Links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/reports/rent-roll" className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:border-blue-200 hover:bg-blue-50">Rent Roll</Link>
        <Link href="/reports/profit-loss" className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:border-blue-200 hover:bg-blue-50">Profit & Loss</Link>
        <Link href="/reports/income-expenses" className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:border-blue-200 hover:bg-blue-50">Income & Expenses</Link>
        <Link href="/reports/deposits" className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:border-blue-200 hover:bg-blue-50">Deposit Tracking</Link>
      </div>

      {/* Report Configs */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Report Schedules ({configs?.length ?? 0})
        </h3>
        {configs && configs.length > 0 ? (
          <div className="space-y-2">
            {configs.map((config) => {
              const property = config.properties as unknown as { name: string } | null;
              return (
                <div key={config.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {property?.name ?? "All Properties"} — {config.report_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {config.recipients.length} recipient{config.recipients.length !== 1 ? "s" : ""}
                      {config.next_send_date && ` · Next: ${config.next_send_date}`}
                    </p>
                  </div>
                  <Badge variant={config.is_active ? "success" : "neutral"}>
                    {config.is_active ? "Active" : "Paused"}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No report schedules configured yet.</p>
        )}
      </Card>

      {/* Generated Reports */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Generated Reports ({reports?.length ?? 0})
        </h3>
        {reports && reports.length > 0 ? (
          <div className="space-y-2">
            {reports.map((report) => {
              const property = report.properties as unknown as { name: string } | null;
              return (
                <div key={report.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {property?.name ?? "Portfolio"} — {report.period_type} ({report.period_date})
                    </p>
                    <p className="text-xs text-gray-500">
                      {report.sent_at ? `Sent ${new Date(report.sent_at).toLocaleDateString()}` : "Not sent"}
                    </p>
                  </div>
                  <Link
                    href={`/reports/${report.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No reports generated yet.</p>
        )}
      </Card>
    </div>
  );
}
