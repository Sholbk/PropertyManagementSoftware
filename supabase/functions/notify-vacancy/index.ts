import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { notifyByRole } from "../_shared/notifications.ts";

/**
 * Vacancy Notification
 *
 * Trigger: Database trigger when a unit's status changes to 'vacant'.
 * Notifies property managers and leasing agents.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { unit_id, organization_id, property_id } = await req.json();
    if (!unit_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "unit_id and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();

    // Fetch unit and property details
    const { data: unit } = await supabase
      .from("units")
      .select(`
        unit_number, market_rent, bedrooms, sqft,
        properties (name)
      `)
      .eq("id", unit_id)
      .single();

    const propertyName = unit?.properties?.name ?? "Unknown property";
    const unitNumber = unit?.unit_number ?? "?";
    const marketRent = unit?.market_rent ? `$${unit.market_rent}/mo` : "unknown";

    await notifyByRole(supabase, {
      organization_id,
      roles: ["owner", "property_manager", "leasing_agent"],
      title: `Vacancy: Unit ${unitNumber} at ${propertyName}`,
      body: `Unit ${unitNumber} (${unit?.bedrooms ?? "?"}br, ${unit?.sqft ?? "?"}sqft) is now vacant. Market rent: ${marketRent}.`,
      entity_type: "unit",
      entity_id: unit_id,
    });

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
