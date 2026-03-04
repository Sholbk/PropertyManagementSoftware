import { createAdminClient } from "../_shared/supabase-admin.ts";
import { getAIProvider } from "../_shared/ai-provider.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { work_order_id } = await req.json();
    if (!work_order_id) {
      return new Response(
        JSON.stringify({ error: "work_order_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();
    const ai = getAIProvider();

    // Fetch work order with related data
    const { data: wo, error: woError } = await supabase
      .from("work_orders")
      .select(`
        *,
        units (unit_number, bedrooms, sqft),
        properties (name, property_type, year_built)
      `)
      .eq("id", work_order_id)
      .single();

    if (woError || !wo) {
      return new Response(
        JSON.stringify({ error: "Work order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch vendors matching category
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, company_name, rating_avg, hourly_rate, specialties")
      .eq("org_id", wo.org_id)
      .eq("is_preferred", true)
      .is("deleted_at", null);

    // AI classification
    const result = await ai.generate({
      system: `You are a property maintenance expert. Analyze work orders and return JSON:
{
  "suggested_category": "plumbing|electrical|hvac|appliance|structural|general|pest|landscaping",
  "priority_score": 0.0-1.0 (1.0 = emergency),
  "priority_reasoning": "brief explanation",
  "estimated_cost_low": number,
  "estimated_cost_high": number,
  "recommended_vendor_id": "uuid or null",
  "vendor_reasoning": "why this vendor",
  "suggested_response": "draft message to tenant"
}
Only return valid JSON, no markdown.`,
      prompt: `Work Order: "${wo.title}"
Description: ${wo.description ?? "none"}
Category (reported): ${wo.category}
Property: ${wo.properties?.name} (${wo.properties?.property_type}, built ${wo.properties?.year_built})
Unit: ${wo.units?.unit_number ?? "common area"}

Available preferred vendors:
${vendors?.map((v) =>
  `- ${v.company_name} (ID: ${v.id}, rating: ${v.rating_avg}, rate: $${v.hourly_rate}/hr, specialties: ${v.specialties.join(", ")})`
).join("\n") ?? "None"}`,
      maxTokens: 600,
    });

    // Parse AI response
    let parsed;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = { suggested_category: wo.category, priority_score: 0.5 };
    }

    // Update work order with AI suggestions
    await supabase.from("work_orders").update({
      ai_category_suggestion: parsed.suggested_category,
      ai_priority_score: parsed.priority_score,
      ai_vendor_suggestion_id: parsed.recommended_vendor_id ?? null,
      ai_estimated_cost: parsed.estimated_cost_high ?? null,
    }).eq("id", work_order_id);

    // Log AI interaction
    await supabase.from("ai_activity_logs").insert({
      org_id: wo.org_id,
      action_type: "classification",
      domain: "maintenance",
      context_entity: "work_order",
      context_id: work_order_id,
      input_summary: `${wo.title}: ${wo.description?.substring(0, 100) ?? ""}`,
      output_summary: `Category: ${parsed.suggested_category}, Priority: ${parsed.priority_score}, Est: $${parsed.estimated_cost_high ?? "?"}`,
      model_provider: result.model.startsWith("claude") ? "anthropic" : "openai",
      model_id: result.model,
      tokens_input: result.tokensInput,
      tokens_output: result.tokensOutput,
    });

    return new Response(
      JSON.stringify({ ok: true, triage: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
