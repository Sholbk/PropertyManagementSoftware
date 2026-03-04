import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * generate-owner-report — Generates owner reports for a given config.
 * Called via cron or on-demand.
 *
 * Body: { config_id: string }
 *
 * Generates a JSON report payload (PDF generation can be added later
 * via a service like Puppeteer/Chromium or a PDF API).
 */

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { config_id } = await req.json();
  if (!config_id) {
    return new Response(JSON.stringify({ error: "config_id required" }), { status: 400 });
  }

  // Fetch config
  const { data: config, error: configErr } = await supabase
    .from("owner_report_configs")
    .select("*")
    .eq("id", config_id)
    .single();

  if (configErr || !config) {
    return new Response(JSON.stringify({ error: "Config not found" }), { status: 404 });
  }

  const orgId = config.organization_id;
  const propertyId = config.property_id;

  // Determine period
  const now = new Date();
  const periodDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString().slice(0, 10);

  // Fetch snapshot data
  let snapshotQuery = supabase
    .from("performance_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .eq("period_type", "monthly")
    .eq("period_date", periodDate);

  if (propertyId) {
    snapshotQuery = snapshotQuery.eq("property_id", propertyId);
  } else {
    snapshotQuery = snapshotQuery.is("property_id", null);
  }

  const { data: snapshot } = await snapshotQuery.maybeSingle();

  // Fetch occupancy data
  let unitsQuery = supabase
    .from("units")
    .select("id, status, market_rent")
    .is("deleted_at", null);

  if (propertyId) {
    unitsQuery = unitsQuery.eq("property_id", propertyId);
  }

  const { data: units } = await unitsQuery;

  // Build report data
  const reportData = {
    organization_id: orgId,
    property_id: propertyId,
    period: periodDate,
    report_type: config.report_type,
    sections: {} as Record<string, unknown>,
  };

  const sections = config.include_sections ?? [];

  if (sections.includes("financial_summary") && snapshot) {
    reportData.sections.financial_summary = {
      noi: snapshot.noi,
      effective_gross_income: snapshot.effective_gross_income,
      operating_expenses: snapshot.operating_expenses,
      vacancy_loss: snapshot.vacancy_loss,
      rent_collection_rate: snapshot.rent_collection_rate,
    };
  }

  if (sections.includes("occupancy") && units) {
    const occupied = units.filter((u) => u.status === "occupied").length;
    const vacant = units.filter((u) => u.status === "vacant").length;
    reportData.sections.occupancy = {
      total_units: units.length,
      occupied,
      vacant,
      occupancy_rate: units.length > 0 ? occupied / units.length : 0,
    };
  }

  if (sections.includes("maintenance") && snapshot) {
    reportData.sections.maintenance = {
      requests_opened: snapshot.requests_opened,
      work_orders_completed: snapshot.work_orders_completed,
      avg_completion_hours: snapshot.avg_completion_hours,
      maintenance_costs: snapshot.maintenance_costs,
    };
  }

  if (sections.includes("leasing") && snapshot) {
    reportData.sections.leasing = {
      leases_expiring: snapshot.leases_expiring,
      leases_renewed: snapshot.leases_renewed,
      new_leases_signed: snapshot.new_leases_signed,
      tenant_retention_rate: snapshot.tenant_retention_rate,
    };
  }

  // Store report as JSON (PDF generation can wrap this later)
  const reportJson = JSON.stringify(reportData, null, 2);
  const fileName = `reports/${orgId}/${periodDate}-${config.report_type}.json`;

  // Upload to Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from("owner-reports")
    .upload(fileName, new Blob([reportJson], { type: "application/json" }), {
      upsert: true,
    });

  const reportUrl = uploadErr
    ? `data:application/json;base64,${btoa(reportJson)}`
    : supabase.storage.from("owner-reports").getPublicUrl(fileName).data.publicUrl;

  // Create report record
  const { data: report, error: insertErr } = await supabase
    .from("owner_reports")
    .insert({
      organization_id: orgId,
      config_id: config.id,
      property_id: propertyId,
      period_type: config.report_type,
      period_date: periodDate,
      report_url: reportUrl,
      sent_to: config.recipients ?? [],
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
  }

  // Update config's last_sent_at
  await supabase
    .from("owner_report_configs")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", config.id);

  return new Response(JSON.stringify({
    message: "Report generated",
    report_id: report.id,
    report_url: reportUrl,
  }));
});
