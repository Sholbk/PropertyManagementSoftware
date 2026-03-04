import { createAdminClient } from "../_shared/supabase-admin.ts";
import { getAIProvider } from "../_shared/ai-provider.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import { logAIAction, estimateCost } from "../_shared/ai-logger.ts";
import { parseAIResponse, checkRateLimit } from "../_shared/guardrails.ts";

/**
 * AI KPI Anomaly Detection
 *
 * Trigger: Daily cron after compute-metrics runs.
 * Compares current period snapshots against historical trends
 * and flags anything unusual.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    const { organization_id, user_id } = await req.json();
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

    // Fetch last 6 months of snapshots
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: snapshots } = await supabase
      .from("performance_snapshots")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("period_type", "monthly")
      .gte("period_date", sixMonthsAgo.toISOString().split("T")[0])
      .order("period_date", { ascending: true });

    if (!snapshots || snapshots.length < 2) {
      return new Response(
        JSON.stringify({ ok: true, analysis: { anomalies: [], overall_health: "insufficient_data", summary: "Need at least 2 months of data for trend analysis." } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by property
    const byProperty = new Map<string | null, typeof snapshots>();
    for (const snap of snapshots) {
      const key = snap.property_id;
      if (!byProperty.has(key)) byProperty.set(key, []);
      byProperty.get(key)!.push(snap);
    }

    // Fetch property names
    const propertyIds = [...byProperty.keys()].filter(Boolean) as string[];
    const { data: properties } = await supabase
      .from("properties")
      .select("id, name")
      .in("id", propertyIds);

    const propNames = new Map(properties?.map((p) => [p.id, p.name]) ?? []);

    // Build trend summary for AI
    const trendLines: string[] = [];
    for (const [propId, snaps] of byProperty) {
      const name = propId ? (propNames.get(propId) ?? propId) : "Portfolio Total";
      const sorted = snaps.sort((a, b) => a.period_date.localeCompare(b.period_date));

      trendLines.push(`
${name} (${sorted.length} months):
${sorted.map((s) => `  ${s.period_date}: NOI=$${s.noi ?? "?"}, Vacancy=${((s.vacancy_rate ?? 0) * 100).toFixed(1)}%, Collection=${((s.rent_collection_rate ?? 0) * 100).toFixed(1)}%, AvgCompletionHrs=${s.avg_completion_hours ?? "?"}, MaintCost/Unit=$${s.maintenance_cost_per_unit ?? "?"}, Satisfaction=${s.avg_tenant_satisfaction ?? "?"}/5, Retention=${((s.tenant_retention_rate ?? 0) * 100).toFixed(1)}%`
      ).join("\n")}
      `.trim());
    }

    const prompt = `Organization KPI trends (last 6 months):\n\n${trendLines.join("\n\n")}`;

    const result = await ai.generate({
      system: PROMPTS.KPI_ANOMALY.system,
      prompt,
      maxTokens: PROMPTS.KPI_ANOMALY.maxTokens,
    });

    const latencyMs = Date.now() - startTime;
    const cost = estimateCost(result.model, result.tokensInput, result.tokensOutput);

    const { parsed, error: parseError } = parseAIResponse<{
      anomalies: Array<{
        kpi: string;
        severity: string;
        current_value: number;
        expected_value: number;
        deviation_pct: number;
        property_id: string | null;
        description: string;
        likely_cause: string;
        recommended_action: string;
      }>;
      overall_health: string;
      summary: string;
    }>(result.text, ["anomalies", "overall_health", "summary"]);

    await logAIAction(supabase, {
      organization_id,
      user_id,
      action_type: "analysis",
      domain: "financial",
      input_summary: `KPI anomaly scan: ${byProperty.size} properties, ${snapshots.length} snapshots`,
      output_summary: parsed
        ? `Health: ${parsed.overall_health}, ${parsed.anomalies.length} anomalies. ${parsed.summary}`
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

    // Create notifications for critical anomalies
    if (parsed) {
      const critical = parsed.anomalies.filter((a) => a.severity === "critical");
      if (critical.length > 0) {
        // Notify all owners
        const { data: owners } = await supabase
          .from("memberships")
          .select("user_id")
          .eq("organization_id", organization_id)
          .eq("role", "owner")
          .eq("status", "active");

        for (const owner of owners ?? []) {
          await supabase.from("notifications").insert({
            organization_id,
            user_id: owner.user_id,
            title: `Critical KPI alert: ${critical.length} anomalies detected`,
            body: critical.map((a) => a.description).join("; "),
            entity_type: "performance_snapshot",
          });
        }
      }
    }

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
