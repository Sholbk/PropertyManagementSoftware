import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { notifyByRole } from "../_shared/notifications.ts";

/**
 * Late Payment Notification
 *
 * Trigger: Daily pg_cron job scanning overdue rent payments.
 * Notifies property managers and accounting staff.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { transaction_id, organization_id } = await req.json();
    if (!transaction_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "transaction_id and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();

    // Fetch transaction with tenant and unit details
    const { data: txn, error: txnError } = await supabase
      .from("financial_transactions")
      .select(`
        *,
        tenants (first_name, last_name),
        leases (unit_id, monthly_rent),
        properties (name)
      `)
      .eq("id", transaction_id)
      .single();

    if (txnError || !txn) {
      return new Response(
        JSON.stringify({ error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate days overdue
    const daysOverdue = Math.floor(
      (Date.now() - new Date(txn.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const tenantName = txn.tenants
      ? `${txn.tenants.first_name} ${txn.tenants.last_name}`
      : "Unknown tenant";

    await notifyByRole(supabase, {
      organization_id,
      roles: ["owner", "property_manager", "accounting"],
      title: `Late payment: ${tenantName} — $${txn.amount}`,
      body: `Rent payment of $${txn.amount} at ${txn.properties?.name ?? "unknown property"} is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue (due ${txn.due_date}).`,
      entity_type: "financial_transaction",
      entity_id: transaction_id,
    });

    return new Response(
      JSON.stringify({ ok: true, days_overdue: daysOverdue }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
