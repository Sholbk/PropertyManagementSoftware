import { createAdminClient } from "../_shared/supabase-admin.ts";
import { getAIProvider } from "../_shared/ai-provider.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import { logAIAction, estimateCost } from "../_shared/ai-logger.ts";
import {
  scrubPII,
  verifyOrgScope,
  parseAIResponse,
  checkHumanReview,
  checkRateLimit,
} from "../_shared/guardrails.ts";
import { notifyByRole } from "../_shared/notifications.ts";

/**
 * AI Maintenance Triage
 *
 * Trigger: Database webhook on maintenance_requests INSERT
 * OR manual call from the UI.
 *
 * Flow:
 * 1. Fetch request + property context
 * 2. Scrub PII from prompt
 * 3. Verify all entities belong to same org
 * 4. Call AI for classification
 * 5. Validate response
 * 6. Check if human review needed
 * 7. Update request with AI results
 * 8. Log everything
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    const { maintenance_request_id, user_id } = await req.json();
    if (!maintenance_request_id) {
      return new Response(
        JSON.stringify({ error: "maintenance_request_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();
    const ai = getAIProvider();

    // Fetch the maintenance request with related data
    const { data: request, error: reqError } = await supabase
      .from("maintenance_requests")
      .select(`
        *,
        units (unit_number, bedrooms, sqft, status),
        properties (name, property_type, year_built, city, state)
      `)
      .eq("id", maintenance_request_id)
      .single();

    if (reqError || !request) {
      return new Response(
        JSON.stringify({ error: "Maintenance request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit check
    const rateCheck = await checkRateLimit(supabase, request.organization_id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateCheck.reason }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify org scope
    const scopeCheck = await verifyOrgScope(supabase, request.organization_id, [
      { table: "maintenance_requests", id: maintenance_request_id },
    ]);
    if (!scopeCheck.valid) {
      return new Response(
        JSON.stringify({ error: "Org scope violation", details: scopeCheck.violations }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch preferred vendors matching category
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, company_name, rating_avg, hourly_rate, specialties, insurance_expiry")
      .eq("organization_id", request.organization_id)
      .is("deleted_at", null)
      .order("is_preferred", { ascending: false })
      .order("rating_avg", { ascending: false })
      .limit(10);

    // Build prompt with PII scrubbed
    const prompt = scrubPII(`
Maintenance Request: "${request.title}"
Description: ${request.description ?? "none provided"}
Category (reported by tenant): ${request.category}
Priority (reported): ${request.priority}
Property: ${request.properties?.name} (${request.properties?.property_type}, built ${request.properties?.year_built}, ${request.properties?.city}, ${request.properties?.state})
Unit: ${request.units?.unit_number ?? "common area"} (${request.units?.bedrooms ?? "?"}br, ${request.units?.sqft ?? "?"}sqft)
Entry permitted: ${request.entry_permitted ? "yes" : "no"}

Available vendors:
${vendors?.map((v) =>
  `- ${v.company_name} (ID: ${v.id}, rating: ${v.rating_avg}/5, $${v.hourly_rate}/hr, specialties: ${v.specialties.join(", ")}, insurance expires: ${v.insurance_expiry ?? "unknown"})`
).join("\n") ?? "No vendors available"}
    `.trim());

    // Call AI
    const result = await ai.generate({
      system: PROMPTS.MAINTENANCE_TRIAGE.system,
      prompt,
      maxTokens: PROMPTS.MAINTENANCE_TRIAGE.maxTokens,
    });

    const latencyMs = Date.now() - startTime;

    // Parse and validate response
    const { parsed, error: parseError } = parseAIResponse<{
      suggested_category: string;
      priority_score: number;
      priority_reasoning: string;
      estimated_cost_low: number;
      estimated_cost_high: number;
      recommended_vendor_id: string | null;
      vendor_reasoning: string | null;
      suggested_tenant_response: string;
      requires_human_review: boolean;
      review_reason: string | null;
    }>(result.text, ["suggested_category", "priority_score"]);

    if (parseError || !parsed) {
      // Log the failure
      await logAIAction(supabase, {
        organization_id: request.organization_id,
        user_id,
        action_type: "classification",
        domain: "maintenance",
        context_entity: "maintenance_request",
        context_id: maintenance_request_id,
        input_summary: request.title,
        output_summary: `PARSE ERROR: ${parseError}`,
        model_provider: result.model.includes("claude") ? "anthropic" : "openai",
        model_id: result.model,
        tokens_input: result.tokensInput,
        tokens_output: result.tokensOutput,
        latency_ms: latencyMs,
      });

      return new Response(
        JSON.stringify({ error: "AI response parse error", detail: parseError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if human review is needed
    const review = checkHumanReview(parsed as unknown as Record<string, unknown>, {
      priority: request.priority,
      estimatedCost: parsed.estimated_cost_high,
    });

    // Update maintenance request with AI results
    await supabase.from("maintenance_requests").update({
      ai_category: parsed.suggested_category,
      ai_priority_score: parsed.priority_score,
      ai_summary: `${parsed.priority_reasoning}. Est: $${parsed.estimated_cost_low}-$${parsed.estimated_cost_high}`,
    }).eq("id", maintenance_request_id);

    // Log the successful AI action
    const cost = estimateCost(result.model, result.tokensInput, result.tokensOutput);
    await logAIAction(supabase, {
      organization_id: request.organization_id,
      user_id,
      action_type: "classification",
      domain: "maintenance",
      context_entity: "maintenance_request",
      context_id: maintenance_request_id,
      input_summary: `${request.title}: ${request.description?.substring(0, 100) ?? ""}`,
      output_summary: `Category: ${parsed.suggested_category}, Priority: ${parsed.priority_score}, Est: $${parsed.estimated_cost_high}, Review: ${review.needsReview}`,
      full_prompt: prompt,
      full_response: result.text,
      model_provider: result.model.includes("claude") ? "anthropic" : "openai",
      model_id: result.model,
      tokens_input: result.tokensInput,
      tokens_output: result.tokensOutput,
      latency_ms: latencyMs,
      cost_usd: cost,
    });

    // Always notify property managers of new maintenance requests
    await notifyByRole(supabase, {
      organization_id: request.organization_id,
      roles: ["owner", "property_manager"],
      title: `New maintenance request: ${request.title}`,
      body: parsed
        ? `Category: ${parsed.suggested_category}, Priority: ${parsed.priority_score}/10. Est: $${parsed.estimated_cost_low}-$${parsed.estimated_cost_high}.`
        : `New request submitted. AI triage pending.`,
      entity_type: "maintenance_request",
      entity_id: maintenance_request_id,
    });

    // If human review needed, send an additional urgent notification
    if (review.needsReview) {
      const { data: property } = await supabase
        .from("properties")
        .select("manager_id")
        .eq("id", request.property_id)
        .single();

      if (property?.manager_id) {
        await supabase.from("notifications").insert({
          organization_id: request.organization_id,
          user_id: property.manager_id,
          title: `AI triage needs review: ${request.title}`,
          body: review.reasons.join("; "),
          entity_type: "maintenance_request",
          entity_id: maintenance_request_id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        triage: parsed,
        needs_human_review: review.needsReview,
        review_reasons: review.reasons,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
