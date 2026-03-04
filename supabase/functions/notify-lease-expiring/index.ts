import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { notifyByRole } from "../_shared/notifications.ts";

/**
 * Lease Expiring Notification
 *
 * Trigger: Daily pg_cron job checking leases expiring within 90 days.
 * Notifies property managers and leasing agents.
 * The cron also calls ai-lease-advisor separately for renewal predictions.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { lease_id, organization_id } = await req.json();
    if (!lease_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "lease_id and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();

    // Fetch lease with tenant, unit, property
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        *,
        tenants (first_name, last_name),
        units (unit_number),
        properties (name)
      `)
      .eq("id", lease_id)
      .single();

    if (leaseError || !lease) {
      return new Response(
        JSON.stringify({ error: "Lease not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate days until expiry
    const daysUntilExpiry = Math.floor(
      (new Date(lease.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const tenantName = lease.tenants
      ? `${lease.tenants.first_name} ${lease.tenants.last_name}`
      : "Unknown tenant";
    const propertyName = lease.properties?.name ?? "Unknown property";
    const unitNumber = lease.units?.unit_number ?? "?";

    await notifyByRole(supabase, {
      organization_id,
      roles: ["owner", "property_manager", "leasing_agent"],
      title: `Lease expiring in ${daysUntilExpiry} days: ${tenantName}`,
      body: `Lease for ${tenantName} at ${propertyName}, Unit ${unitNumber} expires on ${lease.end_date}. Current rent: $${lease.monthly_rent}/mo.`,
      entity_type: "lease",
      entity_id: lease_id,
    });

    return new Response(
      JSON.stringify({ ok: true, days_until_expiry: daysUntilExpiry }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
