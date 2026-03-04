import { createAdminClient } from "../_shared/supabase-admin.ts";
import { getAIProvider } from "../_shared/ai-provider.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import { logAIAction, estimateCost } from "../_shared/ai-logger.ts";
import { scrubPII, parseAIResponse, checkHumanReview, checkRateLimit } from "../_shared/guardrails.ts";

/**
 * AI Lease Renewal Risk Prediction
 *
 * Trigger: Cron job checking leases expiring in 90 days
 * OR manual call from leasing dashboard.
 *
 * Analyzes tenant history and market data to predict renewal likelihood
 * and recommend terms.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    const { lease_id, user_id } = await req.json();
    if (!lease_id) {
      return new Response(
        JSON.stringify({ error: "lease_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();
    const ai = getAIProvider();

    // Fetch lease with tenant and unit data
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        *,
        tenants (first_name, last_name, credit_score, income_annual),
        units (unit_number, market_rent, sqft, bedrooms, status),
        properties (name, city, state, property_type)
      `)
      .eq("id", lease_id)
      .single();

    if (leaseError || !lease) {
      return new Response(
        JSON.stringify({ error: "Lease not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit
    const rateCheck = await checkRateLimit(supabase, lease.organization_id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateCheck.reason }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch payment history for this tenant
    const { data: payments } = await supabase
      .from("financial_transactions")
      .select("amount, due_date, paid_date, status, type")
      .eq("organization_id", lease.organization_id)
      .eq("tenant_id", lease.tenant_id)
      .eq("type", "rent_payment")
      .order("transaction_date", { ascending: false })
      .limit(24);

    // Calculate payment stats
    const totalPayments = payments?.length ?? 0;
    const latePayments = payments?.filter((p) => {
      if (!p.due_date || !p.paid_date) return false;
      return new Date(p.paid_date) > new Date(p.due_date);
    }).length ?? 0;
    const missedPayments = payments?.filter((p) => p.status === "pending" || p.status === "failed").length ?? 0;

    // Fetch maintenance satisfaction for this tenant
    const { data: requests } = await supabase
      .from("maintenance_requests")
      .select("resolution_rating, status")
      .eq("organization_id", lease.organization_id)
      .eq("tenant_id", lease.tenant_id);

    const avgSatisfaction = requests?.filter((r) => r.resolution_rating)
      .reduce((sum, r, _, arr) => sum + (r.resolution_rating! / arr.length), 0) ?? 0;

    // Fetch property vacancy rate
    const { data: units } = await supabase
      .from("units")
      .select("status")
      .eq("property_id", lease.property_id)
      .is("deleted_at", null);

    const totalUnits = units?.length ?? 1;
    const vacantUnits = units?.filter((u) => u.status === "vacant").length ?? 0;
    const vacancyRate = vacantUnits / totalUnits;

    // Build prompt
    const prompt = scrubPII(`
Lease Analysis:
- Tenant: ${lease.tenants?.first_name} ${lease.tenants?.last_name}
- Property: ${lease.properties?.name} (${lease.properties?.city}, ${lease.properties?.state})
- Unit: ${lease.units?.unit_number} (${lease.units?.bedrooms}br, ${lease.units?.sqft}sqft)
- Current rent: $${lease.monthly_rent}/mo
- Market rent for this unit: $${lease.units?.market_rent}/mo
- Lease started: ${lease.start_date}
- Lease expires: ${lease.end_date}
- Lease type: ${lease.lease_type}
- Tenant credit score: ${lease.tenants?.credit_score ?? "unknown"}

Payment History (last 24 months):
- Total rent charges: ${totalPayments}
- Late payments: ${latePayments}
- Missed/failed payments: ${missedPayments}
- On-time rate: ${totalPayments > 0 ? Math.round(((totalPayments - latePayments - missedPayments) / totalPayments) * 100) : "N/A"}%

Maintenance:
- Total requests filed: ${requests?.length ?? 0}
- Average satisfaction rating: ${avgSatisfaction > 0 ? avgSatisfaction.toFixed(1) : "no ratings"}/5

Property Context:
- Current vacancy rate: ${(vacancyRate * 100).toFixed(1)}%
- Rent vs market: ${lease.units?.market_rent ? ((lease.monthly_rent / lease.units.market_rent - 1) * 100).toFixed(1) : "unknown"}%
    `.trim());

    const result = await ai.generate({
      system: PROMPTS.LEASE_RENEWAL_RISK.system,
      prompt,
      maxTokens: PROMPTS.LEASE_RENEWAL_RISK.maxTokens,
    });

    const latencyMs = Date.now() - startTime;

    const { parsed, error: parseError } = parseAIResponse<{
      renewal_probability: number;
      risk_level: string;
      risk_factors: string[];
      recommended_action: string;
      suggested_rent_adjustment_pct: number;
      suggested_incentives: string[];
      confidence: number;
      requires_human_review: boolean;
    }>(result.text, ["renewal_probability", "risk_level", "recommended_action"]);

    const cost = estimateCost(result.model, result.tokensInput, result.tokensOutput);

    await logAIAction(supabase, {
      organization_id: lease.organization_id,
      user_id,
      action_type: "prediction",
      domain: "leasing",
      context_entity: "lease",
      context_id: lease_id,
      input_summary: `Renewal risk: ${lease.tenants?.first_name} ${lease.tenants?.last_name}, $${lease.monthly_rent}/mo, expires ${lease.end_date}`,
      output_summary: parsed
        ? `Renewal: ${(parsed.renewal_probability * 100).toFixed(0)}%, Risk: ${parsed.risk_level}, Adj: ${parsed.suggested_rent_adjustment_pct}%`
        : `PARSE ERROR: ${parseError}`,
      full_prompt: prompt,
      full_response: result.text,
      model_provider: result.model.includes("claude") ? "anthropic" : "openai",
      model_id: result.model,
      tokens_input: result.tokensInput,
      tokens_output: result.tokensOutput,
      latency_ms: latencyMs,
      cost_usd: cost,
    });

    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "AI response parse error", detail: parseError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const review = checkHumanReview(parsed as unknown as Record<string, unknown>, {
      confidenceThreshold: 0.6,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        prediction: parsed,
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
