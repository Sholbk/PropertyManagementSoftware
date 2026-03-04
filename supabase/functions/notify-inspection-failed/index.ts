import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createNotification, notifyByRole } from "../_shared/notifications.ts";

/**
 * Inspection Failed Notification
 *
 * Trigger: Database trigger when inspection status → 'failed'.
 * Notifies property manager, inspector, and maintenance team.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { inspection_id, organization_id } = await req.json();
    if (!inspection_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "inspection_id and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();

    // Fetch inspection with property and unit details
    const { data: inspection, error: inspError } = await supabase
      .from("inspections")
      .select(`
        *,
        properties (name),
        units (unit_number)
      `)
      .eq("id", inspection_id)
      .single();

    if (inspError || !inspection) {
      return new Response(
        JSON.stringify({ error: "Inspection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const propertyName = inspection.properties?.name ?? "Unknown property";
    const unitNumber = inspection.units?.unit_number ?? "common area";
    const inspType = inspection.inspection_type.replace("_", " ");

    // Summarize findings
    const findings = Array.isArray(inspection.findings) ? inspection.findings : [];
    const findingSummary = findings.length > 0
      ? `${findings.length} issue${findings.length !== 1 ? "s" : ""} found.`
      : "See inspection details.";

    const deadlineInfo = inspection.follow_up_deadline
      ? ` Follow-up deadline: ${inspection.follow_up_deadline}.`
      : "";

    // Notify property managers and maintenance techs
    await notifyByRole(supabase, {
      organization_id,
      roles: ["owner", "property_manager", "maintenance_tech"],
      title: `Inspection failed: ${propertyName}, Unit ${unitNumber}`,
      body: `${inspType.charAt(0).toUpperCase() + inspType.slice(1)} inspection failed. ${findingSummary}${deadlineInfo}`,
      entity_type: "inspection",
      entity_id: inspection_id,
    });

    // Also notify the inspector directly if they have a user account
    if (inspection.inspector_id) {
      await createNotification(supabase, {
        organization_id,
        user_id: inspection.inspector_id,
        title: `Your inspection failed: ${propertyName}, Unit ${unitNumber}`,
        body: `The ${inspType} inspection you conducted requires follow-up. ${findingSummary}${deadlineInfo}`,
        entity_type: "inspection",
        entity_id: inspection_id,
      });
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
