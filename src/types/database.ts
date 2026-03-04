// ============================================================================
// PMPP Database Types — v2 Schema
// Matches supabase/migrations/010_schema_v2.sql
// ============================================================================

export type UserRole =
  | "owner"
  | "property_manager"
  | "maintenance_tech"
  | "leasing_agent"
  | "accounting"
  | "vendor_user"
  | "resident";

export type PropertyType =
  | "single_family"
  | "multi_family"
  | "commercial"
  | "mixed_use"
  | "industrial";

export type UnitStatus =
  | "vacant"
  | "occupied"
  | "maintenance"
  | "renovation"
  | "off_market";

export type LeaseStatus =
  | "draft"
  | "pending_signature"
  | "active"
  | "month_to_month"
  | "expired"
  | "terminated"
  | "renewed";

export type MaintenanceCategory =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "appliance"
  | "structural"
  | "pest"
  | "landscaping"
  | "safety"
  | "general"
  | "other";

export type MaintenanceRequestStatus =
  | "new"
  | "acknowledged"
  | "work_order_created"
  | "resolved"
  | "closed"
  | "cancelled";

export type WorkOrderPriority = "emergency" | "high" | "medium" | "low";

export type WorkOrderStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "pending_parts"
  | "pending_vendor"
  | "completed"
  | "verified"
  | "closed"
  | "cancelled";

export type TransactionType =
  | "rent_payment"
  | "security_deposit"
  | "late_fee"
  | "pet_fee"
  | "parking_fee"
  | "utility_charge"
  | "maintenance_expense"
  | "vendor_payment"
  | "insurance"
  | "tax"
  | "management_fee"
  | "capex"
  | "refund"
  | "adjustment"
  | "other_income"
  | "other_expense";

export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | "voided";

export type MembershipStatus = "active" | "invited" | "suspended";

export type InspectionType =
  | "move_in"
  | "move_out"
  | "routine"
  | "safety"
  | "annual";

export type InspectionStatus =
  | "scheduled"
  | "in_progress"
  | "passed"
  | "failed"
  | "needs_followup";

export type AiActionType =
  | "classification"
  | "recommendation"
  | "generation"
  | "analysis"
  | "prediction"
  | "automation"
  | "chat_response";

// ============================================================================
// Table Row Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logo_url: string | null;
  timezone: string;
  settings: Record<string, unknown>;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Membership {
  id: string;
  user_id: string;
  organization_id: string;
  role: UserRole;
  status: MembershipStatus;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  organization_id: string;
  name: string;
  property_type: PropertyType;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  year_built: number | null;
  total_sqft: number | null;
  manager_id: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Unit {
  id: string;
  organization_id: string;
  property_id: string;
  unit_number: string;
  floor_number: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  unit_type: string | null;
  market_rent: number | null;
  status: UnitStatus;
  amenities: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Tenant {
  id: string;
  organization_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  credit_score: number | null;
  income_annual: number | null;
  employer: string | null;
  emergency_contact: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Lease {
  id: string;
  organization_id: string;
  property_id: string;
  unit_id: string;
  tenant_id: string;
  lease_type: "fixed" | "month_to_month";
  status: LeaseStatus;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  security_deposit: number | null;
  pet_deposit: number | null;
  late_fee_amount: number | null;
  late_fee_grace_days: number | null;
  rent_due_day: number;
  escalation_pct: number | null;
  terms: Record<string, unknown>;
  document_urls: string[];
  previous_lease_id: string | null;
  signed_at: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MaintenanceRequest {
  id: string;
  organization_id: string;
  property_id: string;
  unit_id: string | null;
  tenant_id: string | null;
  reported_by: string | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  priority: WorkOrderPriority;
  status: MaintenanceRequestStatus;
  photos: string[];
  entry_permitted: boolean;
  entry_notes: string | null;
  ai_category: string | null;
  ai_priority_score: number | null;
  ai_summary: string | null;
  resolution_rating: number | null;
  resolution_feedback: string | null;
  reported_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Vendor {
  id: string;
  organization_id: string;
  user_id: string | null;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  specialties: string[];
  hourly_rate: number | null;
  flat_rates: Record<string, unknown>;
  rating_avg: number;
  rating_count: number;
  insurance_provider: string | null;
  insurance_expiry: string | null;
  license_number: string | null;
  w9_on_file: boolean;
  is_preferred: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkOrder {
  id: string;
  organization_id: string;
  maintenance_request_id: string | null;
  property_id: string;
  unit_id: string | null;
  assigned_to: string | null;
  vendor_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  category: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  scheduled_date: string | null;
  scheduled_window: string | null;
  due_date: string | null;
  resolution_notes: string | null;
  parts_used: unknown[];
  labor_hours: number | null;
  material_cost: number | null;
  labor_cost: number | null;
  total_cost: number | null;
  ai_vendor_suggestion_id: string | null;
  ai_estimated_cost: number | null;
  ai_estimated_hours: number | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FinancialTransaction {
  id: string;
  organization_id: string;
  property_id: string;
  unit_id: string | null;
  lease_id: string | null;
  tenant_id: string | null;
  vendor_id: string | null;
  work_order_id: string | null;
  type: TransactionType;
  category: string;
  description: string | null;
  status: TransactionStatus;
  amount: number;
  tax_amount: number;
  transaction_date: string;
  due_date: string | null;
  paid_date: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_method: string | null;
  reference_number: string | null;
  stripe_payment_id: string | null;
  quickbooks_id: string | null;
  is_reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PerformanceSnapshot {
  id: string;
  organization_id: string;
  property_id: string | null;
  period_type: "daily" | "weekly" | "monthly" | "quarterly";
  period_date: string;
  // Revenue
  gross_potential_rent: number | null;
  effective_gross_income: number | null;
  vacancy_loss: number | null;
  other_income: number | null;
  // Expenses
  operating_expenses: number | null;
  maintenance_costs: number | null;
  management_fees: number | null;
  insurance_costs: number | null;
  tax_costs: number | null;
  capex: number | null;
  // Core KPIs
  noi: number | null;
  vacancy_rate: number | null;
  occupancy_rate: number | null;
  avg_rent_per_unit: number | null;
  revenue_per_sqft: number | null;
  expense_ratio: number | null;
  rent_collection_rate: number | null;
  delinquency_rate: number | null;
  delinquent_amount: number | null;
  // Maintenance KPIs
  requests_opened: number | null;
  work_orders_opened: number | null;
  work_orders_completed: number | null;
  avg_response_hours: number | null;
  avg_completion_hours: number | null;
  maintenance_cost_per_unit: number | null;
  emergency_count: number | null;
  avg_tenant_satisfaction: number | null;
  // Leasing KPIs
  leases_expiring: number | null;
  leases_renewed: number | null;
  new_leases_signed: number | null;
  leases_terminated: number | null;
  tenant_retention_rate: number | null;
  avg_days_to_lease: number | null;
  avg_rent_growth_pct: number | null;
  // Portfolio counts
  total_units: number | null;
  occupied_units: number | null;
  vacant_units: number | null;
  computed_at: string;
}

export interface AiActionLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action_type: AiActionType;
  domain: string;
  context_entity: string | null;
  context_id: string | null;
  input_summary: string;
  output_summary: string;
  full_prompt: string | null;
  full_response: string | null;
  model_provider: string;
  model_id: string;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  cost_usd: number | null;
  was_accepted: boolean | null;
  feedback: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  body: string | null;
  channel: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Inspection {
  id: string;
  organization_id: string;
  property_id: string;
  unit_id: string | null;
  inspection_type: InspectionType;
  status: InspectionStatus;
  inspector_id: string | null;
  scheduled_date: string;
  completed_date: string | null;
  overall_result: "pass" | "fail" | "conditional" | null;
  findings: unknown[];
  photos: string[];
  notes: string | null;
  follow_up_required: boolean;
  follow_up_deadline: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ============================================================================
// Supabase Database interface (for typed client)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization> & Pick<Organization, "name" | "slug">; Update: Partial<Organization> };
      users: { Row: User; Insert: Partial<User> & Pick<User, "id" | "email" | "full_name">; Update: Partial<User> };
      memberships: { Row: Membership; Insert: Partial<Membership> & Pick<Membership, "user_id" | "organization_id" | "role">; Update: Partial<Membership> };
      properties: { Row: Property; Insert: Partial<Property> & Pick<Property, "organization_id" | "name" | "property_type" | "address_line1" | "city" | "state" | "zip">; Update: Partial<Property> };
      units: { Row: Unit; Insert: Partial<Unit> & Pick<Unit, "organization_id" | "property_id" | "unit_number">; Update: Partial<Unit> };
      tenants: { Row: Tenant; Insert: Partial<Tenant> & Pick<Tenant, "organization_id" | "first_name" | "last_name">; Update: Partial<Tenant> };
      leases: { Row: Lease; Insert: Partial<Lease> & Pick<Lease, "organization_id" | "property_id" | "unit_id" | "tenant_id" | "start_date" | "monthly_rent">; Update: Partial<Lease> };
      maintenance_requests: { Row: MaintenanceRequest; Insert: Partial<MaintenanceRequest> & Pick<MaintenanceRequest, "organization_id" | "property_id" | "title" | "category">; Update: Partial<MaintenanceRequest> };
      vendors: { Row: Vendor; Insert: Partial<Vendor> & Pick<Vendor, "organization_id" | "company_name">; Update: Partial<Vendor> };
      work_orders: { Row: WorkOrder; Insert: Partial<WorkOrder> & Pick<WorkOrder, "organization_id" | "property_id" | "title" | "category" | "created_by">; Update: Partial<WorkOrder> };
      financial_transactions: { Row: FinancialTransaction; Insert: Partial<FinancialTransaction> & Pick<FinancialTransaction, "organization_id" | "property_id" | "type" | "category" | "amount" | "transaction_date" | "created_by">; Update: Partial<FinancialTransaction> };
      performance_snapshots: { Row: PerformanceSnapshot; Insert: Partial<PerformanceSnapshot> & Pick<PerformanceSnapshot, "organization_id" | "period_type" | "period_date">; Update: Partial<PerformanceSnapshot> };
      ai_action_logs: { Row: AiActionLog; Insert: Partial<AiActionLog> & Pick<AiActionLog, "organization_id" | "action_type" | "domain" | "input_summary" | "output_summary" | "model_provider" | "model_id">; Update: Partial<AiActionLog> };
      notifications: { Row: Notification; Insert: Partial<Notification> & Pick<Notification, "organization_id" | "user_id" | "title">; Update: Partial<Notification> };
      inspections: { Row: Inspection; Insert: Partial<Inspection> & Pick<Inspection, "organization_id" | "property_id" | "inspection_type" | "scheduled_date" | "created_by">; Update: Partial<Inspection> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
