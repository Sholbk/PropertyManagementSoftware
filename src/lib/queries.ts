import { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function getPortfolioSnapshots(supabase: Client, orgId: string, months = 6) {
  return supabase
    .from("performance_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .is("property_id", null)
    .eq("period_type", "monthly")
    .order("period_date", { ascending: false })
    .limit(months);
}

export async function getPropertySnapshots(supabase: Client, orgId: string, propertyId: string, months = 6) {
  return supabase
    .from("performance_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .eq("property_id", propertyId)
    .eq("period_type", "monthly")
    .order("period_date", { ascending: false })
    .limit(months);
}

export async function getProperties(supabase: Client, orgId: string) {
  return supabase
    .from("properties")
    .select("id, name, property_type, address_line1, city, state, zip, year_built, total_sqft, manager_id")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("name");
}

export async function getPropertyById(supabase: Client, propertyId: string) {
  return supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .single();
}

export async function getUnitsForProperty(supabase: Client, propertyId: string) {
  return supabase
    .from("units")
    .select("id, unit_number, floor_number, bedrooms, bathrooms, sqft, market_rent, status")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("unit_number");
}

export async function getUnitById(supabase: Client, unitId: string) {
  return supabase
    .from("units")
    .select("*")
    .eq("id", unitId)
    .is("deleted_at", null)
    .single();
}

export async function getActiveLeaseForUnit(supabase: Client, unitId: string) {
  return supabase
    .from("leases")
    .select("*, tenants(id, first_name, last_name, email, phone)")
    .eq("unit_id", unitId)
    .in("status", ["active", "month_to_month"])
    .is("deleted_at", null)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getOpenWorkOrderCount(supabase: Client, orgId: string) {
  return supabase
    .from("work_orders")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .not("status", "in", "(completed,verified,closed,cancelled)")
    .is("deleted_at", null);
}

export async function getOpenWorkOrders(supabase: Client, orgId: string, propertyId?: string) {
  let query = supabase
    .from("work_orders")
    .select("id, title, category, priority, status, assigned_to, property_id, unit_id, created_at, vendor_id")
    .eq("organization_id", orgId)
    .not("status", "in", "(completed,verified,closed,cancelled)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (propertyId) query = query.eq("property_id", propertyId);
  return query;
}

export async function getWorkOrders(supabase: Client, orgId: string, propertyId?: string) {
  let query = supabase
    .from("work_orders")
    .select("id, title, category, priority, status, assigned_to, property_id, unit_id, created_at, completed_at, total_cost, vendor_id")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (propertyId) query = query.eq("property_id", propertyId);
  return query;
}

export async function getMaintenanceRequests(supabase: Client, orgId: string, propertyId?: string) {
  let query = supabase
    .from("maintenance_requests")
    .select("id, title, category, priority, status, ai_category, ai_priority_score, ai_summary, reported_at, property_id, unit_id")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("reported_at", { ascending: false })
    .limit(50);
  if (propertyId) query = query.eq("property_id", propertyId);
  return query;
}

export async function getActiveLeases(supabase: Client, orgId: string, propertyId?: string) {
  let query = supabase
    .from("leases")
    .select("id, unit_id, tenant_id, monthly_rent, start_date, end_date, status, tenants(first_name, last_name), units(unit_number), properties(name)")
    .eq("organization_id", orgId)
    .in("status", ["active", "month_to_month"])
    .is("deleted_at", null)
    .order("end_date", { ascending: true });
  if (propertyId) query = query.eq("property_id", propertyId);
  return query;
}

export async function getRecentAiInsights(supabase: Client, orgId: string, limit = 10) {
  return supabase
    .from("ai_action_logs")
    .select("id, action_type, domain, context_entity, context_id, output_summary, was_accepted, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getUnreadNotificationCount(supabase: Client, userId: string) {
  return supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

export async function getNotifications(supabase: Client, userId: string, limit = 20) {
  return supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getUnitMaintenanceHistory(supabase: Client, unitId: string) {
  return supabase
    .from("maintenance_requests")
    .select("id, title, category, priority, status, reported_at, resolved_at, ai_summary")
    .eq("unit_id", unitId)
    .is("deleted_at", null)
    .order("reported_at", { ascending: false })
    .limit(20);
}

export async function getUnitTransactions(supabase: Client, unitId: string) {
  return supabase
    .from("financial_transactions")
    .select("id, type, amount, status, transaction_date, due_date, paid_date, description")
    .eq("unit_id", unitId)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .limit(24);
}

// ============================================================================
// Revenue Feature Queries
// ============================================================================

export async function getAiUsageQuota(supabase: Client, orgId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return supabase
    .from("ai_usage_quotas")
    .select("*")
    .eq("organization_id", orgId)
    .lte("period_start", today)
    .gte("period_end", today)
    .maybeSingle();
}

export async function getMaintenanceMarkups(supabase: Client, orgId: string, limit = 50) {
  return supabase
    .from("maintenance_markups")
    .select("id, vendor_cost, owner_charge, markup_amount, markup_pct, notes, invoice_number, billed_to, created_at, work_order_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getVendorMarketplaceProfiles(supabase: Client, state?: string, specialty?: string) {
  let query = supabase
    .from("vendor_marketplace_profiles")
    .select("id, company_name, contact_name, state, city, specialties, hourly_rate_min, hourly_rate_max, rating_avg, rating_count, is_verified, listing_tier, description")
    .eq("is_active", true)
    .order("listing_tier", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(50);
  if (state) query = query.eq("state", state);
  if (specialty) query = query.contains("specialties", [specialty]);
  return query;
}

export async function getVendorReviews(supabase: Client, profileId: string) {
  return supabase
    .from("vendor_reviews")
    .select("id, rating, review_text, response_text, created_at")
    .eq("vendor_marketplace_profile_id", profileId)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);
}

export async function getOwnerReportConfigs(supabase: Client, orgId: string) {
  return supabase
    .from("owner_report_configs")
    .select("id, property_id, report_type, recipients, is_active, last_sent_at, next_send_date, properties(name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
}

export async function getOwnerReports(supabase: Client, orgId: string, limit = 20) {
  return supabase
    .from("owner_reports")
    .select("id, period_type, period_date, report_url, sent_at, properties(name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getBenchmarkData(supabase: Client, propertyTypes: string[], states: string[]) {
  return supabase
    .from("benchmark_data")
    .select("*")
    .in("property_type", propertyTypes)
    .in("state", states)
    .eq("period_type", "monthly")
    .order("period_date", { ascending: false })
    .limit(20);
}
