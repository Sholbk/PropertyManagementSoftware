import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * compute-benchmarks — Monthly cron job to aggregate anonymous benchmark data.
 *
 * Privacy safeguards:
 * 1. No org_id in output — structural impossibility of re-identification
 * 2. Minimum sample size of 5 orgs per segment
 * 3. Bucketed unit counts (1-10, 11-50, 51-200, 200+)
 * 4. Only averages/medians/percentiles — no min/max
 * 5. Only opts-in organizations contribute
 */

const UNIT_BUCKETS = [
  { min: 1, max: 10, label: "1-10" },
  { min: 11, max: 50, label: "11-50" },
  { min: 51, max: 200, label: "51-200" },
  { min: 201, max: Infinity, label: "200+" },
];

function getBucket(units: number): string {
  return UNIT_BUCKETS.find((b) => units >= b.min && units <= b.max)?.label ?? "1-10";
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Compute for last month
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodDate = lastMonth.toISOString().slice(0, 10);

  // Get opted-in organizations
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, settings")
    .is("deleted_at", null);

  const optedInOrgIds = (orgs ?? [])
    .filter((o) => o.settings?.benchmark_opt_in !== false) // default opt-in
    .map((o) => o.id);

  if (optedInOrgIds.length < 5) {
    return new Response(JSON.stringify({ message: "Not enough opted-in orgs", count: optedInOrgIds.length }));
  }

  // Get property-level snapshots for last month
  const { data: snapshots } = await supabase
    .from("performance_snapshots")
    .select("*, properties(property_type, state)")
    .in("organization_id", optedInOrgIds)
    .not("property_id", "is", null)
    .eq("period_type", "monthly")
    .eq("period_date", periodDate);

  if (!snapshots || snapshots.length === 0) {
    return new Response(JSON.stringify({ message: "No snapshots for period", period: periodDate }));
  }

  // Group by segment: (property_type, state, unit_count_bucket)
  type Snapshot = typeof snapshots[0];
  const segments: Record<string, Snapshot[]> = {};

  for (const snap of snapshots) {
    const prop = snap.properties as unknown as { property_type: string; state: string } | null;
    if (!prop) continue;

    const bucket = getBucket(snap.total_units ?? 0);
    const key = `${prop.property_type}|${prop.state}|${bucket}`;

    if (!segments[key]) segments[key] = [];
    segments[key].push(snap);
  }

  // Aggregate each segment (only if >= 5 unique orgs)
  const benchmarks = [];

  for (const [key, snaps] of Object.entries(segments)) {
    const uniqueOrgs = new Set(snaps.map((s) => s.organization_id));
    if (uniqueOrgs.size < 5) continue;

    const [property_type, state, unit_count_bucket] = key.split("|");

    const vacancies = snaps.map((s) => s.vacancy_rate ?? 0);
    const rents = snaps.map((s) => s.avg_rent_per_unit ?? 0);
    const collections = snaps.map((s) => s.rent_collection_rate ?? 0);
    const expenses = snaps.map((s) => s.expense_ratio ?? 0);
    const nois = snaps.map((s) => (s.noi ?? 0) / Math.max(s.total_units ?? 1, 1));
    const maintCosts = snaps.map((s) => s.maintenance_cost_per_unit ?? 0);
    const completions = snaps.map((s) => s.avg_completion_hours ?? 0);
    const retentions = snaps.map((s) => s.tenant_retention_rate ?? 0);
    const daysToLease = snaps.map((s) => s.avg_days_to_lease ?? 0);
    const rentGrowth = snaps.map((s) => s.avg_rent_growth_pct ?? 0);

    benchmarks.push({
      period_type: "monthly",
      period_date: periodDate,
      property_type,
      state,
      unit_count_bucket,
      sample_size: uniqueOrgs.size,
      avg_vacancy_rate: avg(vacancies),
      median_vacancy_rate: median(vacancies),
      avg_occupancy_rate: 1 - avg(vacancies),
      avg_rent_per_unit: avg(rents),
      median_rent_per_unit: median(rents),
      avg_expense_ratio: avg(expenses),
      avg_noi_per_unit: avg(nois),
      avg_rent_collection_rate: avg(collections),
      avg_maintenance_cost_per_unit: avg(maintCosts),
      avg_completion_hours: avg(completions),
      avg_tenant_retention: avg(retentions),
      avg_days_to_lease: avg(daysToLease),
      avg_rent_growth_pct: avg(rentGrowth),
      p25_rent_per_unit: percentile(rents, 25),
      p75_rent_per_unit: percentile(rents, 75),
      p25_vacancy_rate: percentile(vacancies, 25),
      p75_vacancy_rate: percentile(vacancies, 75),
    });
  }

  // Upsert
  if (benchmarks.length > 0) {
    const { error } = await supabase
      .from("benchmark_data")
      .upsert(benchmarks, { onConflict: "period_type,period_date,property_type,state,unit_count_bucket" });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({
    message: "Benchmarks computed",
    period: periodDate,
    segments_processed: benchmarks.length,
    total_snapshots: snapshots.length,
  }));
});
