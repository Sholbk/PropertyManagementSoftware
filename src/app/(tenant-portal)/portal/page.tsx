import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, daysUntil } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Tenant Portal | PMPP" };

export default async function TenantPortalHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Find the tenant record linked to this user
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, first_name, last_name, organization_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-bold text-gray-900">Welcome to PMPP</h2>
        <p className="mt-2 text-gray-500">Your tenant profile has not been linked yet. Please contact your property manager.</p>
      </div>
    );
  }

  // Get active lease
  const { data: lease } = await supabase
    .from("leases")
    .select("id, monthly_rent, start_date, end_date, status, rent_due_day, units(unit_number), properties(name, address_line1, city, state, zip)")
    .eq("tenant_id", tenant.id)
    .in("status", ["active", "month_to_month"])
    .is("deleted_at", null)
    .order("start_date", { ascending: false })
    .maybeSingle();

  // Get open maintenance requests
  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("id, title, status, priority, reported_at")
    .eq("tenant_id", tenant.id)
    .not("status", "in", "(resolved,closed,cancelled)")
    .is("deleted_at", null)
    .order("reported_at", { ascending: false })
    .limit(5);

  // Get recent payments
  const { data: payments } = await supabase
    .from("financial_transactions")
    .select("id, amount, transaction_date, status, type")
    .eq("tenant_id", tenant.id)
    .eq("type", "rent_payment")
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .limit(5);

  const unit = lease?.units as unknown as { unit_number: string } | null;
  const property = lease?.properties as unknown as { name: string; address_line1: string; city: string; state: string; zip: string } | null;
  const days = lease?.end_date ? daysUntil(lease.end_date) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Welcome, {tenant.first_name}</h1>

      {lease ? (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Your Lease</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Property</p>
              <p className="font-medium">{property?.name} — Unit {unit?.unit_number}</p>
              <p className="text-gray-400">{property?.address_line1}, {property?.city}, {property?.state} {property?.zip}</p>
            </div>
            <div>
              <p className="text-gray-500">Monthly Rent</p>
              <p className="text-xl font-bold">{formatCurrency(lease.monthly_rent)}</p>
              <p className="text-gray-400">Due on the {lease.rent_due_day}{lease.rent_due_day === 1 ? "st" : lease.rent_due_day === 2 ? "nd" : lease.rent_due_day === 3 ? "rd" : "th"}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Badge variant={lease.status === "active" ? "success" : "info"}>{lease.status}</Badge>
            {days !== null && days <= 90 && days >= 0 && <Badge variant="warning">{days} days until renewal</Badge>}
          </div>
        </Card>
      ) : (
        <Card><p className="text-sm text-gray-400">No active lease found.</p></Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Open Maintenance Requests</h3>
            <Link href="/portal/maintenance" className="text-sm text-blue-600 hover:underline">New Request</Link>
          </div>
          {requests && requests.length > 0 ? (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                  <span className="text-sm">{req.title}</span>
                  <Badge variant={req.status === "new" ? "danger" : "warning"}>{req.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No open requests</p>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Payments</h3>
            <Link href="/portal/payments" className="text-sm text-blue-600 hover:underline">View All</Link>
          </div>
          {payments && payments.length > 0 ? (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                  <span className="text-sm">{p.transaction_date}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === "completed" ? "success" : "warning"}>{p.status}</Badge>
                    <span className="text-sm font-medium">{formatCurrency(Math.abs(p.amount))}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No payments recorded</p>
          )}
        </Card>
      </div>
    </div>
  );
}
