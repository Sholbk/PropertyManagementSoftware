import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Compute metric snapshots for all organizations.
 * Triggered by pg_cron (hourly) or manually.
 * Uses service_role to bypass RLS and write to metric_snapshots.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.substring(0, 7) + "-01";

  // Get all active organizations
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .eq("subscription_status", "active")
    .is("deleted_at", null);

  if (!orgs) {
    return new Response(JSON.stringify({ error: "No orgs found" }), { status: 500 });
  }

  let computed = 0;

  for (const org of orgs) {
    // Get all properties for this org
    const { data: properties } = await supabase
      .from("properties")
      .select("id, total_units")
      .eq("org_id", org.id)
      .is("deleted_at", null);

    if (!properties) continue;

    for (const prop of properties) {
      // --- Vacancy ---
      const { count: totalUnits } = await supabase
        .from("units")
        .select("*", { count: "exact", head: true })
        .eq("property_id", prop.id)
        .is("deleted_at", null);

      const { count: vacantUnits } = await supabase
        .from("units")
        .select("*", { count: "exact", head: true })
        .eq("property_id", prop.id)
        .eq("status", "vacant")
        .is("deleted_at", null);

      const { count: occupiedUnits } = await supabase
        .from("units")
        .select("*", { count: "exact", head: true })
        .eq("property_id", prop.id)
        .eq("status", "occupied")
        .is("deleted_at", null);

      const vacancyRate = totalUnits && totalUnits > 0
        ? (vacantUnits ?? 0) / totalUnits
        : 0;

      // --- Active lease rent ---
      const { data: activeLeases } = await supabase
        .from("leases")
        .select("monthly_rent")
        .eq("org_id", org.id)
        .in("status", ["active", "month_to_month"])
        .is("deleted_at", null);

      // Filter to leases for this property's units
      const { data: propUnits } = await supabase
        .from("units")
        .select("id")
        .eq("property_id", prop.id)
        .is("deleted_at", null);

      const unitIds = propUnits?.map((u) => u.id) ?? [];

      const { data: propLeases } = await supabase
        .from("leases")
        .select("monthly_rent")
        .eq("org_id", org.id)
        .in("unit_id", unitIds)
        .in("status", ["active", "month_to_month"])
        .is("deleted_at", null);

      const totalRent = propLeases?.reduce((s, l) => s + (l.monthly_rent ?? 0), 0) ?? 0;
      const avgRent = propLeases && propLeases.length > 0
        ? totalRent / propLeases.length
        : 0;

      // --- Maintenance KPIs (this month) ---
      const { data: completedWOs } = await supabase
        .from("work_orders")
        .select("reported_at, completed_at, total_cost")
        .eq("property_id", prop.id)
        .in("status", ["completed", "closed"])
        .gte("completed_at", monthStart)
        .is("deleted_at", null);

      const woCount = completedWOs?.length ?? 0;
      const totalMaintCost = completedWOs?.reduce(
        (s, w) => s + (w.total_cost ?? 0), 0
      ) ?? 0;
      const avgHours = woCount > 0
        ? completedWOs!.reduce((s, w) => {
            if (!w.reported_at || !w.completed_at) return s;
            const diff = new Date(w.completed_at).getTime() - new Date(w.reported_at).getTime();
            return s + diff / (1000 * 60 * 60);
          }, 0) / woCount
        : null;

      // --- Upsert snapshot ---
      await supabase.from("metric_snapshots").upsert(
        {
          org_id: org.id,
          property_id: prop.id,
          period_type: "monthly",
          period_date: monthStart,
          total_units: totalUnits ?? 0,
          occupied_units: occupiedUnits ?? 0,
          vacant_units: vacantUnits ?? 0,
          vacancy_rate: vacancyRate,
          occupancy_rate: 1 - vacancyRate,
          avg_rent_per_unit: avgRent,
          maintenance_cost_per_unit: totalUnits && totalUnits > 0
            ? totalMaintCost / totalUnits
            : 0,
          avg_completion_hours: avgHours,
          work_orders_completed: woCount,
        },
        {
          onConflict: "org_id,property_id,period_type,period_date",
          ignoreDuplicates: false,
        }
      );

      computed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, snapshots_computed: computed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
