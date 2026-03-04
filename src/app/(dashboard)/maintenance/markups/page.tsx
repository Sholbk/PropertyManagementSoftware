import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrgPlan, canAccessFeature } from "@/lib/feature-gate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Maintenance Markups | PMPP" };

export default async function MarkupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const orgPlan = await getOrgPlan(supabase, orgId);
  if (!orgPlan || !canAccessFeature(orgPlan, "maintenance_markup")) {
    redirect("/settings/billing?upgrade=maintenance_markup");
  }

  const { data: markups } = await supabase
    .from("maintenance_markups")
    .select("id, vendor_cost, owner_charge, markup_amount, markup_pct, notes, invoice_number, billed_to, created_at, work_order_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Summary
  const totalVendorCost = markups?.reduce((sum, m) => sum + Number(m.vendor_cost), 0) ?? 0;
  const totalOwnerCharge = markups?.reduce((sum, m) => sum + Number(m.owner_charge), 0) ?? 0;
  const totalMarkup = totalOwnerCharge - totalVendorCost;
  const avgMarkupPct = totalVendorCost > 0 ? ((totalMarkup / totalVendorCost) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Maintenance Markups</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-500">Total Vendor Cost</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalVendorCost)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Total Owner Charges</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalOwnerCharge)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Total Markup</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalMarkup)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Avg Markup %</p>
          <p className="text-xl font-bold text-gray-900">{avgMarkupPct.toFixed(1)}%</p>
        </Card>
      </div>

      {/* Markups Table */}
      {!markups || markups.length === 0 ? (
        <EmptyState title="No markups recorded" description="Markup data will appear here when work orders are completed." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Invoice</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Vendor Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Owner Charge</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Markup</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">%</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Billed To</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {markups.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                      {m.invoice_number ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm">{formatCurrency(Number(m.vendor_cost))}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm">{formatCurrency(Number(m.owner_charge))}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-green-600">
                      {formatCurrency(Number(m.markup_amount))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm">
                      {(Number(m.markup_pct) * 100).toFixed(1)}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {m.billed_to ? <Badge variant="info">{m.billed_to}</Badge> : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
