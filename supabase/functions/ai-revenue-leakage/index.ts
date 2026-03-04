import { createAdminClient } from "../_shared/supabase-admin.ts";
import { getAIProvider } from "../_shared/ai-provider.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import { logAIAction, estimateCost } from "../_shared/ai-logger.ts";
import { parseAIResponse, checkRateLimit } from "../_shared/guardrails.ts";

/**
 * AI Revenue Leakage Detection
 *
 * Trigger: Weekly cron OR manual from financial dashboard.
 *
 * Scans for:
 * - Occupied units with no active lease
 * - Active leases with no rent charges this month
 * - Missing late fees
 * - Below-market rents without escalation clauses
 * - Missing deposits
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    const { organization_id, property_id, user_id } = await req.json();
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();
    const ai = getAIProvider();

    const rateCheck = await checkRateLimit(supabase, organization_id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateCheck.reason }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build property filter
    let propertyFilter = supabase
      .from("properties")
      .select("id, name, organization_id")
      .eq("organization_id", organization_id)
      .is("deleted_at", null);

    if (property_id) {
      propertyFilter = propertyFilter.eq("id", property_id);
    }

    const { data: properties } = await propertyFilter;

    // Gather data for analysis
    const analysisData: string[] = [];

    for (const prop of properties ?? []) {
      // Occupied units
      const { data: occupiedUnits } = await supabase
        .from("units")
        .select("id, unit_number, market_rent, status")
        .eq("property_id", prop.id)
        .eq("status", "occupied")
        .is("deleted_at", null);

      // Active leases
      const { data: activeLeases } = await supabase
        .from("leases")
        .select("id, unit_id, tenant_id, monthly_rent, security_deposit, start_date, terms, escalation_pct")
        .eq("property_id", prop.id)
        .in("status", ["active", "month_to_month"])
        .is("deleted_at", null);

      // This month's rent charges
      const monthStart = new Date();
      monthStart.setDate(1);
      const { data: rentCharges } = await supabase
        .from("financial_transactions")
        .select("lease_id, amount, status, due_date, paid_date")
        .eq("property_id", prop.id)
        .eq("type", "rent_payment")
        .gte("transaction_date", monthStart.toISOString().split("T")[0])
        .is("deleted_at", null);

      // Find occupied units without active leases
      const leasedUnitIds = new Set(activeLeases?.map((l) => l.unit_id) ?? []);
      const unleased = occupiedUnits?.filter((u) => !leasedUnitIds.has(u.id)) ?? [];

      // Find leases without this month's rent charge
      const chargedLeaseIds = new Set(rentCharges?.map((c) => c.lease_id) ?? []);
      const uncharged = activeLeases?.filter((l) => !chargedLeaseIds.has(l.id)) ?? [];

      // Find late payments without late fees
      const latePaid = rentCharges?.filter((c) => {
        if (!c.due_date || !c.paid_date) return false;
        return new Date(c.paid_date) > new Date(c.due_date) && c.status === "completed";
      }) ?? [];

      // Below market rents
      const belowMarket = activeLeases?.filter((l) => {
        const unit = occupiedUnits?.find((u) => u.id === l.unit_id);
        if (!unit?.market_rent) return false;
        return l.monthly_rent < unit.market_rent * 0.9; // more than 10% below market
      }) ?? [];

      analysisData.push(`
Property: ${prop.name} (ID: ${prop.id})
- Occupied units: ${occupiedUnits?.length ?? 0}
- Active leases: ${activeLeases?.length ?? 0}
- Occupied but no lease: ${unleased.map((u) => `Unit ${u.unit_number} (market: $${u.market_rent})`).join(", ") || "none"}
- Active lease but no rent charge this month: ${uncharged.map((l) => `Lease ${l.id.substring(0, 8)}, $${l.monthly_rent}/mo`).join(", ") || "none"}
- Late payments this month without late fee check: ${latePaid.length} instances
- Below-market rents (>10% under): ${belowMarket.map((l) => {
        const unit = occupiedUnits?.find((u) => u.id === l.unit_id);
        return `Unit ${unit?.unit_number}: $${l.monthly_rent} vs market $${unit?.market_rent}, escalation: ${l.escalation_pct ?? "none"}%`;
      }).join("; ") || "none"}
- Leases missing security deposit: ${activeLeases?.filter((l) => !l.security_deposit).length ?? 0}
      `.trim());
    }

    const prompt = analysisData.join("\n\n");

    const result = await ai.generate({
      system: PROMPTS.REVENUE_LEAKAGE.system,
      prompt,
      maxTokens: PROMPTS.REVENUE_LEAKAGE.maxTokens,
    });

    const latencyMs = Date.now() - startTime;
    const cost = estimateCost(result.model, result.tokensInput, result.tokensOutput);

    const { parsed, error: parseError } = parseAIResponse<{
      leakage_items: Array<{
        type: string;
        property_id: string;
        unit_id: string | null;
        estimated_monthly_loss: number;
        description: string;
        recommended_action: string;
      }>;
      total_estimated_monthly_loss: number;
      total_estimated_annual_loss: number;
      confidence: number;
      requires_human_review: boolean;
    }>(result.text, ["leakage_items", "total_estimated_monthly_loss"]);

    await logAIAction(supabase, {
      organization_id,
      user_id,
      action_type: "analysis",
      domain: "financial",
      input_summary: `Revenue leakage scan: ${properties?.length ?? 0} properties`,
      output_summary: parsed
        ? `Found ${parsed.leakage_items.length} items, est loss: $${parsed.total_estimated_monthly_loss}/mo`
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

    return new Response(
      JSON.stringify({ ok: true, analysis: parsed ?? { error: parseError } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
