import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createNotification, notifyByRole } from "../_shared/notifications.ts";

/**
 * Work Order Completion Notification
 *
 * Trigger: Database trigger when work order status → 'completed'/'verified'.
 * Notifies property manager and the tenant who reported the issue.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { work_order_id, organization_id } = await req.json();
    if (!work_order_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "work_order_id and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();

    // Fetch work order with related data
    const { data: wo, error: woError } = await supabase
      .from("work_orders")
      .select(`
        *,
        properties (name),
        units (unit_number),
        vendors (company_name)
      `)
      .eq("id", work_order_id)
      .single();

    if (woError || !wo) {
      return new Response(
        JSON.stringify({ error: "Work order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const propertyName = wo.properties?.name ?? "Unknown property";
    const unitNumber = wo.units?.unit_number ?? "common area";
    const vendorName = wo.vendors?.company_name;
    const costInfo = wo.actual_cost ? ` Cost: $${wo.actual_cost}.` : "";

    // Notify property managers
    await notifyByRole(supabase, {
      organization_id,
      roles: ["owner", "property_manager"],
      title: `Work order completed: ${wo.title}`,
      body: `Work order at ${propertyName}, Unit ${unitNumber} has been completed.${vendorName ? ` Vendor: ${vendorName}.` : ""}${costInfo}`,
      entity_type: "work_order",
      entity_id: work_order_id,
    });

    // If linked to a maintenance request, notify the reporting tenant
    if (wo.maintenance_request_id) {
      const { data: request } = await supabase
        .from("maintenance_requests")
        .select("reported_by, title")
        .eq("id", wo.maintenance_request_id)
        .single();

      if (request?.reported_by) {
        // Find the user_id for this tenant
        const { data: tenant } = await supabase
          .from("tenants")
          .select("user_id")
          .eq("id", request.reported_by)
          .single();

        if (tenant?.user_id) {
          await createNotification(supabase, {
            organization_id,
            user_id: tenant.user_id,
            title: `Your maintenance request has been resolved`,
            body: `"${request.title}" has been completed.${vendorName ? ` Handled by: ${vendorName}.` : ""}`,
            entity_type: "maintenance_request",
            entity_id: wo.maintenance_request_id,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
