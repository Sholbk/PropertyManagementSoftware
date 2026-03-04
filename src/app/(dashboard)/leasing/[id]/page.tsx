import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatCurrency, daysUntil } from "@/lib/utils";
import Link from "next/link";

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  draft: "neutral",
  pending_signature: "warning",
  active: "success",
  month_to_month: "info",
  expired: "danger",
  terminated: "danger",
  renewed: "info",
};

export const metadata = { title: "Lease Detail | PMPP" };

export default async function LeaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lease } = await supabase
    .from("leases")
    .select("*, tenants(id, first_name, last_name, email, phone), units(unit_number), properties(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!lease) notFound();

  const tenant = lease.tenants as unknown as { id: string; first_name: string; last_name: string; email: string; phone: string } | null;
  const unit = lease.units as unknown as { unit_number: string } | null;
  const property = lease.properties as unknown as { name: string } | null;
  const days = lease.end_date ? daysUntil(lease.end_date) : null;

  // Get transactions for this lease
  const { data: transactions } = await supabase
    .from("financial_transactions")
    .select("id, type, amount, status, transaction_date, description")
    .eq("lease_id", id)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Leasing", href: "/leasing" }, { label: `${property?.name} — Unit ${unit?.unit_number}` }]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{property?.name} — Unit {unit?.unit_number}</h1>
          <Badge variant={statusVariant[lease.status] ?? "neutral"}>{lease.status.replace(/_/g, " ")}</Badge>
          {days !== null && days >= 0 && days <= 90 && <Badge variant="warning">{days} days left</Badge>}
        </div>
        <Link href={`/leasing/${id}/edit`} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Tenant</h3>
          {tenant ? (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">Name</dt><dd><Link href={`/tenants/${tenant.id}`} className="text-blue-600 hover:underline">{tenant.first_name} {tenant.last_name}</Link></dd></div>
              {tenant.email && <div><dt className="text-gray-500">Email</dt><dd>{tenant.email}</dd></div>}
              {tenant.phone && <div><dt className="text-gray-500">Phone</dt><dd>{tenant.phone}</dd></div>}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No tenant assigned</p>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Lease Terms</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Type</dt><dd className="capitalize">{lease.lease_type.replace(/_/g, " ")}</dd></div>
            <div><dt className="text-gray-500">Period</dt><dd>{lease.start_date} to {lease.end_date ?? "Ongoing"}</dd></div>
            {lease.move_in_date && <div><dt className="text-gray-500">Move-in</dt><dd>{lease.move_in_date}</dd></div>}
          </dl>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Financial</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Monthly Rent</dt><dd className="font-medium">{formatCurrency(lease.monthly_rent)}</dd></div>
            {lease.security_deposit && <div><dt className="text-gray-500">Security Deposit</dt><dd>{formatCurrency(lease.security_deposit)}</dd></div>}
            {lease.pet_deposit && <div><dt className="text-gray-500">Pet Deposit</dt><dd>{formatCurrency(lease.pet_deposit)}</dd></div>}
            <div><dt className="text-gray-500">Rent Due Day</dt><dd>{lease.rent_due_day} of each month</dd></div>
            {lease.late_fee_amount && <div><dt className="text-gray-500">Late Fee</dt><dd>{formatCurrency(lease.late_fee_amount)} after {lease.late_fee_grace_days ?? 0} grace days</dd></div>}
            {lease.escalation_pct && <div><dt className="text-gray-500">Annual Escalation</dt><dd>{lease.escalation_pct}%</dd></div>}
          </dl>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Documents</h3>
          {lease.document_urls && lease.document_urls.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {lease.document_urls.map((url: string, i: number) => (
                <li key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Document {i + 1}</a></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No documents uploaded</p>
          )}
        </Card>
      </div>

      {/* Transaction History */}
      {transactions && transactions.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Transaction History</h3>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{tx.description || tx.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500">{tx.transaction_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={tx.status === "completed" ? "success" : tx.status === "pending" ? "warning" : "danger"}>{tx.status}</Badge>
                  <span className={`text-sm font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(Math.abs(tx.amount))}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
