import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatCurrency, daysUntil } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Tenant Detail | PMPP" };

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!tenant) notFound();

  const [leasesRes, requestsRes, transactionsRes] = await Promise.all([
    supabase
      .from("leases")
      .select("id, status, monthly_rent, start_date, end_date, units(unit_number), properties(name)")
      .eq("tenant_id", id)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, reported_at, ai_summary")
      .eq("tenant_id", id)
      .is("deleted_at", null)
      .order("reported_at", { ascending: false })
      .limit(10),
    supabase
      .from("financial_transactions")
      .select("id, type, amount, status, transaction_date, description")
      .eq("tenant_id", id)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .limit(12),
  ]);

  const leases = leasesRes.data ?? [];
  const requests = requestsRes.data ?? [];
  const transactions = transactionsRes.data ?? [];
  const ec = tenant.emergency_contact as { name?: string; phone?: string } | null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Tenants", href: "/tenants" }, { label: `${tenant.first_name} ${tenant.last_name}` }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{tenant.first_name} {tenant.last_name}</h1>
        <Link href={`/tenants/${id}/edit`} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Contact Info</h3>
          <dl className="space-y-2 text-sm">
            {tenant.email && <div><dt className="text-gray-500">Email</dt><dd>{tenant.email}</dd></div>}
            {tenant.phone && <div><dt className="text-gray-500">Phone</dt><dd>{tenant.phone}</dd></div>}
            {tenant.date_of_birth && <div><dt className="text-gray-500">DOB</dt><dd>{tenant.date_of_birth}</dd></div>}
          </dl>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Employment</h3>
          <dl className="space-y-2 text-sm">
            {tenant.employer && <div><dt className="text-gray-500">Employer</dt><dd>{tenant.employer}</dd></div>}
            {tenant.income_annual && <div><dt className="text-gray-500">Annual Income</dt><dd>{formatCurrency(tenant.income_annual)}</dd></div>}
            {tenant.credit_score && <div><dt className="text-gray-500">Credit Score</dt><dd>{tenant.credit_score}</dd></div>}
          </dl>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Emergency Contact</h3>
          {ec ? (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">Name</dt><dd>{ec.name}</dd></div>
              {ec.phone && <div><dt className="text-gray-500">Phone</dt><dd>{ec.phone}</dd></div>}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No emergency contact on file</p>
          )}
        </Card>
      </div>

      {/* Leases */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Leases ({leases.length})</h3>
          <Link href={`/leasing/new?tenant_id=${id}`} className="text-sm text-blue-600 hover:underline">New Lease</Link>
        </div>
        {leases.length === 0 ? (
          <p className="text-sm text-gray-400">No leases</p>
        ) : (
          <div className="space-y-2">
            {leases.map((lease) => {
              const unit = lease.units as unknown as { unit_number: string } | null;
              const property = lease.properties as unknown as { name: string } | null;
              const days = lease.end_date ? daysUntil(lease.end_date) : null;
              return (
                <div key={lease.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{property?.name} — Unit {unit?.unit_number}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(lease.monthly_rent)}/mo | {lease.start_date} to {lease.end_date ?? "Month-to-month"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {days !== null && days <= 90 && days >= 0 && <Badge variant="warning">{days}d left</Badge>}
                    <Badge variant={lease.status === "active" ? "success" : lease.status === "month_to_month" ? "info" : "neutral"}>{lease.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Maintenance Requests */}
      {requests.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Maintenance Requests</h3>
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{req.title}</p>
                  {req.ai_summary && <p className="text-xs text-gray-500">{req.ai_summary}</p>}
                </div>
                <Badge variant={req.status === "resolved" ? "success" : req.status === "new" ? "danger" : "warning"}>{req.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent Transactions</h3>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{tx.description || tx.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500">{tx.transaction_date}</p>
                </div>
                <span className={`text-sm font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(Math.abs(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tenant.notes && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Notes</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{tenant.notes}</p>
        </Card>
      )}
    </div>
  );
}
