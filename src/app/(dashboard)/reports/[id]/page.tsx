import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: report } = await supabase
    .from("owner_reports")
    .select("*, properties(name)")
    .eq("id", id)
    .single();

  if (!report) notFound();

  const property = report.properties as unknown as { name: string } | null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Reports", href: "/reports" },
        { label: `${property?.name ?? "Portfolio"} — ${report.period_date}` },
      ]} />

      <h1 className="text-2xl font-bold text-gray-900">
        {property?.name ?? "Portfolio"} Report
      </h1>

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-gray-500">Period</p>
            <p className="font-medium">{report.period_type} — {report.period_date}</p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <Badge variant={report.sent_at ? "success" : "warning"}>
              {report.sent_at ? "Sent" : "Draft"}
            </Badge>
          </div>
          {report.sent_at && (
            <div>
              <p className="text-gray-500">Sent</p>
              <p className="font-medium">{new Date(report.sent_at).toLocaleString()}</p>
            </div>
          )}
          {report.sent_to?.length > 0 && (
            <div>
              <p className="text-gray-500">Recipients</p>
              <p className="font-medium">{report.sent_to.join(", ")}</p>
            </div>
          )}
        </div>
        {report.report_url && (
          <div className="mt-4">
            <a
              href={report.report_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Download PDF
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}
