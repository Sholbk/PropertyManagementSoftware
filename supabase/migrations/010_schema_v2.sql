-- ============================================================================
-- PMPP SCHEMA v2 — Production-Ready
-- PostgreSQL 16+ | Supabase Auth | Multi-tenant via memberships | Soft deletes
-- ============================================================================
-- MIGRATION: This replaces the v1 schema. Run on a fresh Supabase project
-- or drop all v1 tables first.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- HELPER: auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Macro to apply the trigger to a table (called at end of file)
CREATE OR REPLACE FUNCTION _apply_updated_at_trigger(tbl regclass)
RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s
         FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        tbl
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER: auth_org_id (no table dependency — safe to create early)
-- ============================================================================
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'active_org_id')::uuid,
        (auth.jwt() -> 'user_metadata' ->> 'active_org_id')::uuid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- auth_org_role() and auth_has_role() are created AFTER the memberships table
-- (see below, after table 3)

-- ============================================================================
-- 1. ORGANIZATIONS
-- ============================================================================
CREATE TABLE organizations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL,
    plan                TEXT NOT NULL DEFAULT 'starter',
    logo_url            TEXT,
    timezone            TEXT NOT NULL DEFAULT 'America/Chicago',
    settings            JSONB NOT NULL DEFAULT '{}',
    subscription_status TEXT NOT NULL DEFAULT 'trialing',
    trial_ends_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_orgs_slug ON organizations(slug) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. USERS (mirrors auth.users — populated via trigger)
-- ============================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY,                  -- matches auth.users.id
    email           TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    avatar_url      TEXT,
    phone           TEXT,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. MEMBERSHIPS (user ↔ organization, many-to-many with role)
-- ============================================================================
-- A user can belong to multiple orgs (vendor works with many PMs, owner has
-- multiple companies, accountant serves several clients).
-- The "active_org_id" in JWT determines which org context they're operating in.
CREATE TABLE memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN (
                        'owner', 'property_manager', 'maintenance_tech',
                        'leasing_agent', 'accounting', 'vendor_user', 'resident'
                    )),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    invited_by      UUID REFERENCES users(id),
    invited_at      TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_memberships_unique ON memberships(user_id, organization_id)
    WHERE status != 'suspended';
CREATE INDEX idx_memberships_org ON memberships(organization_id, role, status);
CREATE INDEX idx_memberships_user ON memberships(user_id, status);

-- ============================================================================
-- HELPER: role functions (created here because they depend on memberships table)
-- ============================================================================
CREATE OR REPLACE FUNCTION auth_org_role() RETURNS TEXT AS $$
    SELECT role FROM public.memberships
    WHERE user_id = auth.uid()
      AND organization_id = auth_org_id()
      AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_has_role(allowed_roles TEXT[]) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE user_id = auth.uid()
          AND organization_id = auth_org_id()
          AND status = 'active'
          AND role = ANY(allowed_roles)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 4. PROPERTIES
-- ============================================================================
CREATE TABLE properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    property_type   TEXT NOT NULL CHECK (property_type IN (
                        'single_family', 'multi_family', 'commercial', 'mixed_use', 'industrial'
                    )),
    address_line1   TEXT NOT NULL,
    address_line2   TEXT,
    city            TEXT NOT NULL,
    state           TEXT NOT NULL,
    zip             TEXT NOT NULL,
    county          TEXT,
    latitude        NUMERIC(10, 7),
    longitude       NUMERIC(10, 7),
    year_built      SMALLINT,
    total_sqft      INT,
    manager_id      UUID REFERENCES users(id),
    purchase_price  NUMERIC(14, 2),
    purchase_date   DATE,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_properties_org ON properties(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_manager ON properties(organization_id, manager_id)
    WHERE deleted_at IS NULL AND manager_id IS NOT NULL;
CREATE INDEX idx_properties_location ON properties(state, city) WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. UNITS
-- ============================================================================
CREATE TABLE units (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    property_id     UUID NOT NULL REFERENCES properties(id),
    unit_number     TEXT NOT NULL,
    floor_number    SMALLINT,
    bedrooms        SMALLINT,
    bathrooms       NUMERIC(3, 1),
    sqft            INT,
    unit_type       TEXT,
    market_rent     NUMERIC(10, 2),
    status          TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN (
                        'vacant', 'occupied', 'maintenance', 'renovation', 'off_market'
                    )),
    amenities       TEXT[] DEFAULT '{}',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_units_number ON units(property_id, unit_number)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_units_org_property ON units(organization_id, property_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_units_status ON units(organization_id, status)
    WHERE deleted_at IS NULL;
-- KPI: fast vacancy count per property
CREATE INDEX idx_units_vacancy ON units(organization_id, property_id, status)
    WHERE deleted_at IS NULL AND status = 'vacant';

-- ============================================================================
-- 6. TENANTS (residents / lessees)
-- ============================================================================
CREATE TABLE tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    user_id             UUID REFERENCES users(id),     -- if tenant has portal access
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    email               TEXT,
    phone               TEXT,
    date_of_birth       DATE,
    ssn_encrypted       BYTEA,
    credit_score        SMALLINT,
    income_annual       NUMERIC(12, 2),
    employer            TEXT,
    emergency_contact   JSONB,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_tenants_org ON tenants(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_name ON tenants(organization_id, last_name, first_name)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_email ON tenants(organization_id, email)
    WHERE deleted_at IS NULL AND email IS NOT NULL;

-- ============================================================================
-- 7. LEASES
-- ============================================================================
CREATE TABLE leases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    property_id         UUID NOT NULL REFERENCES properties(id),
    unit_id             UUID NOT NULL REFERENCES units(id),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    lease_type          TEXT NOT NULL DEFAULT 'fixed' CHECK (lease_type IN ('fixed', 'month_to_month')),
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                            'draft', 'pending_signature', 'active', 'month_to_month',
                            'expired', 'terminated', 'renewed'
                        )),
    start_date          DATE NOT NULL,
    end_date            DATE,
    monthly_rent        NUMERIC(10, 2) NOT NULL,
    security_deposit    NUMERIC(10, 2),
    pet_deposit         NUMERIC(10, 2),
    late_fee_amount     NUMERIC(8, 2),
    late_fee_grace_days SMALLINT DEFAULT 5,
    rent_due_day        SMALLINT NOT NULL DEFAULT 1,
    escalation_pct      NUMERIC(5, 2),
    terms               JSONB NOT NULL DEFAULT '{}',
    document_urls       TEXT[] DEFAULT '{}',
    previous_lease_id   UUID REFERENCES leases(id),
    signed_at           TIMESTAMPTZ,
    move_in_date        DATE,
    move_out_date       DATE,
    terminated_at       TIMESTAMPTZ,
    termination_reason  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_leases_org_status ON leases(organization_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_leases_unit ON leases(organization_id, unit_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_leases_tenant ON leases(organization_id, tenant_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_leases_property ON leases(organization_id, property_id, status)
    WHERE deleted_at IS NULL;
-- KPI: lease expiration pipeline
CREATE INDEX idx_leases_expiring ON leases(organization_id, end_date)
    WHERE deleted_at IS NULL AND status IN ('active', 'month_to_month') AND end_date IS NOT NULL;
-- KPI: rent growth on renewals
CREATE INDEX idx_leases_renewal_chain ON leases(previous_lease_id)
    WHERE previous_lease_id IS NOT NULL;

-- Lease change history (append-only, written by trigger)
CREATE TABLE lease_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    lease_id        UUID NOT NULL REFERENCES leases(id),
    changed_by      UUID REFERENCES users(id),
    field_name      TEXT NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    change_reason   TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lease_audit ON lease_audit_log(lease_id, changed_at DESC);
CREATE INDEX idx_lease_audit_org ON lease_audit_log(organization_id, changed_at DESC);

-- ============================================================================
-- 8. MAINTENANCE REQUESTS (tenant-reported issues)
-- ============================================================================
CREATE TABLE maintenance_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    property_id         UUID NOT NULL REFERENCES properties(id),
    unit_id             UUID REFERENCES units(id),
    tenant_id           UUID REFERENCES tenants(id),
    reported_by         UUID REFERENCES users(id),

    title               TEXT NOT NULL,
    description         TEXT,
    category            TEXT NOT NULL CHECK (category IN (
                            'plumbing', 'electrical', 'hvac', 'appliance', 'structural',
                            'pest', 'landscaping', 'safety', 'general', 'other'
                        )),
    priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN (
                            'emergency', 'high', 'medium', 'low'
                        )),
    status              TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                            'new', 'acknowledged', 'work_order_created', 'resolved', 'closed', 'cancelled'
                        )),
    photos              TEXT[] DEFAULT '{}',
    entry_permitted     BOOLEAN DEFAULT true,
    entry_notes         TEXT,

    -- AI triage results
    ai_category         TEXT,
    ai_priority_score   NUMERIC(4, 3),
    ai_summary          TEXT,

    -- Tenant satisfaction
    resolution_rating   SMALLINT CHECK (resolution_rating BETWEEN 1 AND 5),
    resolution_feedback TEXT,

    reported_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at     TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_maint_req_org_status ON maintenance_requests(organization_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_maint_req_property ON maintenance_requests(organization_id, property_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_maint_req_tenant ON maintenance_requests(organization_id, tenant_id)
    WHERE deleted_at IS NULL AND tenant_id IS NOT NULL;
-- KPI: open request aging
CREATE INDEX idx_maint_req_open ON maintenance_requests(organization_id, reported_at)
    WHERE deleted_at IS NULL AND status NOT IN ('resolved', 'closed', 'cancelled');

-- ============================================================================
-- 9. VENDORS
-- ============================================================================
CREATE TABLE vendors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    user_id             UUID REFERENCES users(id),     -- portal access
    company_name        TEXT NOT NULL,
    contact_name        TEXT,
    email               TEXT,
    phone               TEXT,
    address             TEXT,
    specialties         TEXT[] NOT NULL DEFAULT '{}',
    hourly_rate         NUMERIC(8, 2),
    flat_rates          JSONB DEFAULT '{}',
    rating_avg          NUMERIC(3, 2) DEFAULT 0,
    rating_count        INT DEFAULT 0,
    insurance_provider  TEXT,
    insurance_expiry    DATE,
    license_number      TEXT,
    w9_on_file          BOOLEAN DEFAULT false,
    is_preferred        BOOLEAN DEFAULT false,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_vendors_org ON vendors(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_specialties ON vendors USING GIN (specialties)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_preferred ON vendors(organization_id)
    WHERE deleted_at IS NULL AND is_preferred = true;

-- ============================================================================
-- 10. WORK ORDERS (assigned work — may or may not originate from a request)
-- ============================================================================
CREATE TABLE work_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id),
    maintenance_request_id  UUID REFERENCES maintenance_requests(id),
    property_id             UUID NOT NULL REFERENCES properties(id),
    unit_id                 UUID REFERENCES units(id),
    assigned_to             UUID REFERENCES users(id),
    vendor_id               UUID REFERENCES vendors(id),
    created_by              UUID NOT NULL REFERENCES users(id),

    title                   TEXT NOT NULL,
    description             TEXT,
    category                TEXT NOT NULL,
    priority                TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN (
                                'emergency', 'high', 'medium', 'low'
                            )),
    status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
                                'open', 'assigned', 'in_progress', 'pending_parts',
                                'pending_vendor', 'completed', 'verified', 'closed', 'cancelled'
                            )),

    -- Scheduling
    scheduled_date          DATE,
    scheduled_window        TEXT,
    due_date                DATE,

    -- Resolution
    resolution_notes        TEXT,
    parts_used              JSONB DEFAULT '[]',
    labor_hours             NUMERIC(6, 2),
    material_cost           NUMERIC(10, 2) DEFAULT 0,
    labor_cost              NUMERIC(10, 2) DEFAULT 0,
    total_cost              NUMERIC(10, 2) GENERATED ALWAYS AS (
                                COALESCE(material_cost, 0) + COALESCE(labor_cost, 0)
                            ) STORED,

    -- AI fields
    ai_vendor_suggestion_id UUID REFERENCES vendors(id),
    ai_estimated_cost       NUMERIC(10, 2),
    ai_estimated_hours      NUMERIC(6, 2),

    -- Timestamps
    assigned_at             TIMESTAMPTZ,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    verified_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_wo_org_status ON work_orders(organization_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_property ON work_orders(organization_id, property_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_assigned ON work_orders(organization_id, assigned_to, status)
    WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;
CREATE INDEX idx_wo_vendor ON work_orders(organization_id, vendor_id)
    WHERE deleted_at IS NULL AND vendor_id IS NOT NULL;
CREATE INDEX idx_wo_request ON work_orders(maintenance_request_id)
    WHERE maintenance_request_id IS NOT NULL;
-- KPI: avg completion time
CREATE INDEX idx_wo_completion ON work_orders(organization_id, property_id, created_at, completed_at)
    WHERE deleted_at IS NULL AND completed_at IS NOT NULL;
-- KPI: open work order count by priority
CREATE INDEX idx_wo_open_priority ON work_orders(organization_id, priority)
    WHERE deleted_at IS NULL AND status NOT IN ('completed', 'verified', 'closed', 'cancelled');

-- Work order status changelog (for SLA tracking)
CREATE TABLE work_order_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,              -- status_change | note | photo | assignment
    old_value       TEXT,
    new_value       TEXT,
    notes           TEXT,
    attachments     TEXT[] DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wo_events ON work_order_events(work_order_id, created_at DESC);

-- ============================================================================
-- 11. FINANCIAL TRANSACTIONS
-- ============================================================================
CREATE TABLE financial_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    property_id         UUID NOT NULL REFERENCES properties(id),
    unit_id             UUID REFERENCES units(id),
    lease_id            UUID REFERENCES leases(id),
    tenant_id           UUID REFERENCES tenants(id),
    vendor_id           UUID REFERENCES vendors(id),
    work_order_id       UUID REFERENCES work_orders(id),

    -- Classification
    type                TEXT NOT NULL CHECK (type IN (
                            'rent_payment', 'security_deposit', 'late_fee', 'pet_fee',
                            'parking_fee', 'utility_charge', 'maintenance_expense',
                            'vendor_payment', 'insurance', 'tax', 'management_fee',
                            'capex', 'refund', 'adjustment', 'other_income', 'other_expense'
                        )),
    category            TEXT NOT NULL,                  -- GL account category
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'completed', 'failed', 'refunded', 'voided'
                        )),

    -- Amount: positive = income, negative = expense
    amount              NUMERIC(12, 2) NOT NULL,
    tax_amount          NUMERIC(10, 2) DEFAULT 0,

    -- Dates
    transaction_date    DATE NOT NULL,
    due_date            DATE,
    paid_date           DATE,
    period_start        DATE,
    period_end          DATE,

    -- Payment info
    payment_method      TEXT,
    reference_number    TEXT,
    stripe_payment_id   TEXT,
    quickbooks_id       TEXT,

    -- Reconciliation
    is_reconciled       BOOLEAN NOT NULL DEFAULT false,
    reconciled_at       TIMESTAMPTZ,
    reconciled_by       UUID REFERENCES users(id),

    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_txn_org_property ON financial_transactions(organization_id, property_id, transaction_date DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_txn_type ON financial_transactions(organization_id, type, transaction_date DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_txn_lease ON financial_transactions(organization_id, lease_id)
    WHERE deleted_at IS NULL AND lease_id IS NOT NULL;
CREATE INDEX idx_txn_tenant ON financial_transactions(organization_id, tenant_id)
    WHERE deleted_at IS NULL AND tenant_id IS NOT NULL;
CREATE INDEX idx_txn_vendor ON financial_transactions(organization_id, vendor_id)
    WHERE deleted_at IS NULL AND vendor_id IS NOT NULL;
-- KPI: rent collection rate (pending rent past due)
CREATE INDEX idx_txn_delinquent ON financial_transactions(organization_id, due_date)
    WHERE deleted_at IS NULL AND status = 'pending' AND type = 'rent_payment' AND due_date IS NOT NULL;
-- KPI: monthly income/expense rollup
CREATE INDEX idx_txn_rollup ON financial_transactions(organization_id, property_id, type, status, transaction_date)
    WHERE deleted_at IS NULL AND status = 'completed';

-- ============================================================================
-- 12. PERFORMANCE SNAPSHOTS (pre-computed KPIs)
-- ============================================================================
-- Written by the compute-metrics Edge Function on cron.
-- Dashboards read ONLY from this table for fast queries.
CREATE TABLE performance_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id),
    property_id             UUID REFERENCES properties(id),    -- NULL = portfolio-level
    period_type             TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
    period_date             DATE NOT NULL,                     -- first day of period

    -- Revenue
    gross_potential_rent    NUMERIC(12, 2),
    effective_gross_income  NUMERIC(12, 2),
    vacancy_loss            NUMERIC(12, 2),
    other_income            NUMERIC(12, 2),

    -- Expenses
    operating_expenses      NUMERIC(12, 2),
    maintenance_costs       NUMERIC(12, 2),
    management_fees         NUMERIC(12, 2),
    insurance_costs         NUMERIC(12, 2),
    tax_costs               NUMERIC(12, 2),
    capex                   NUMERIC(12, 2),

    -- Core KPIs
    noi                     NUMERIC(12, 2),
    vacancy_rate            NUMERIC(6, 4),
    occupancy_rate          NUMERIC(6, 4),
    avg_rent_per_unit       NUMERIC(10, 2),
    revenue_per_sqft        NUMERIC(10, 4),
    expense_ratio           NUMERIC(6, 4),
    rent_collection_rate    NUMERIC(6, 4),
    delinquency_rate        NUMERIC(6, 4),
    delinquent_amount       NUMERIC(12, 2),

    -- Maintenance KPIs
    requests_opened         INT,
    work_orders_opened      INT,
    work_orders_completed   INT,
    avg_response_hours      NUMERIC(10, 2),    -- request reported → acknowledged
    avg_completion_hours    NUMERIC(10, 2),     -- work order created → completed
    maintenance_cost_per_unit NUMERIC(10, 2),
    emergency_count         INT,
    avg_tenant_satisfaction NUMERIC(3, 2),

    -- Leasing KPIs
    leases_expiring         INT,
    leases_renewed          INT,
    new_leases_signed       INT,
    leases_terminated       INT,
    tenant_retention_rate   NUMERIC(6, 4),
    avg_days_to_lease       NUMERIC(8, 2),
    avg_rent_growth_pct     NUMERIC(6, 4),

    -- Portfolio counts
    total_units             INT,
    occupied_units          INT,
    vacant_units            INT,

    computed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_perf_snap_unique ON performance_snapshots(
    organization_id,
    COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_type,
    period_date
);
CREATE INDEX idx_perf_snap_dashboard ON performance_snapshots(organization_id, period_type, period_date DESC);
CREATE INDEX idx_perf_snap_property ON performance_snapshots(organization_id, property_id, period_type, period_date DESC)
    WHERE property_id IS NOT NULL;

-- ============================================================================
-- 13. AI ACTION LOGS (append-only)
-- ============================================================================
CREATE TABLE ai_action_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    user_id             UUID REFERENCES users(id),
    action_type         TEXT NOT NULL CHECK (action_type IN (
                            'classification', 'recommendation', 'generation',
                            'analysis', 'prediction', 'automation', 'chat_response'
                        )),
    domain              TEXT NOT NULL,                  -- maintenance | leasing | financial | general
    context_entity      TEXT,                           -- work_order | lease | transaction | etc.
    context_id          UUID,

    input_summary       TEXT NOT NULL,
    output_summary      TEXT NOT NULL,
    full_prompt         TEXT,
    full_response       TEXT,

    model_provider      TEXT NOT NULL,
    model_id            TEXT NOT NULL,
    tokens_input        INT,
    tokens_output       INT,
    latency_ms          INT,
    cost_usd            NUMERIC(8, 6),

    was_accepted        BOOLEAN,
    feedback            TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    -- No updated_at, no deleted_at — append only
);

CREATE INDEX idx_ai_log_org ON ai_action_logs(organization_id, created_at DESC);
CREATE INDEX idx_ai_log_domain ON ai_action_logs(organization_id, domain, created_at DESC);
CREATE INDEX idx_ai_log_context ON ai_action_logs(context_entity, context_id)
    WHERE context_id IS NOT NULL;
CREATE INDEX idx_ai_log_acceptance ON ai_action_logs(organization_id, action_type, was_accepted)
    WHERE was_accepted IS NOT NULL;

-- ============================================================================
-- 14. NOTIFICATIONS
-- ============================================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    body            TEXT,
    channel         TEXT NOT NULL DEFAULT 'in_app',
    entity_type     TEXT,
    entity_id       UUID,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notif_org ON notifications(organization_id, created_at DESC);

-- ============================================================================
-- APPLY updated_at TRIGGERS
-- ============================================================================
SELECT _apply_updated_at_trigger('organizations');
SELECT _apply_updated_at_trigger('users');
SELECT _apply_updated_at_trigger('memberships');
SELECT _apply_updated_at_trigger('properties');
SELECT _apply_updated_at_trigger('units');
SELECT _apply_updated_at_trigger('tenants');
SELECT _apply_updated_at_trigger('leases');
SELECT _apply_updated_at_trigger('maintenance_requests');
SELECT _apply_updated_at_trigger('vendors');
SELECT _apply_updated_at_trigger('work_orders');
SELECT _apply_updated_at_trigger('financial_transactions');

-- Clean up the helper function
DROP FUNCTION _apply_updated_at_trigger(regclass);

-- ============================================================================
-- LEASE AUDIT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION log_lease_changes()
RETURNS TRIGGER AS $$
DECLARE
    col TEXT;
    old_val TEXT;
    new_val TEXT;
    changer UUID;
BEGIN
    changer := COALESCE(
        NULLIF(current_setting('app.current_user_id', true), '')::UUID,
        auth.uid()
    );

    FOREACH col IN ARRAY ARRAY[
        'status', 'monthly_rent', 'end_date', 'lease_type',
        'security_deposit', 'escalation_pct', 'terminated_at', 'termination_reason'
    ]
    LOOP
        EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', col, col)
            INTO old_val, new_val USING OLD, NEW;

        IF old_val IS DISTINCT FROM new_val THEN
            INSERT INTO lease_audit_log (organization_id, lease_id, changed_by, field_name, old_value, new_value)
            VALUES (NEW.organization_id, NEW.id, changer, col, old_val, new_val);
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_lease_audit
    AFTER UPDATE ON leases
    FOR EACH ROW EXECUTE FUNCTION log_lease_changes();

-- ============================================================================
-- AUTH SYNC: create public.users row when auth.users row is created
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;

    -- If invited with org context, create membership
    IF NEW.raw_app_meta_data ? 'org_id' AND NEW.raw_app_meta_data ? 'role' THEN
        INSERT INTO public.memberships (user_id, organization_id, role, status)
        VALUES (
            NEW.id,
            (NEW.raw_app_meta_data ->> 'org_id')::UUID,
            NEW.raw_app_meta_data ->> 'role',
            'active'
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_auth_user_created();

-- Update last_login_at on sign-in
CREATE OR REPLACE FUNCTION handle_auth_user_login()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
        UPDATE public.users SET last_login_at = now() WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_login
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_auth_user_login();

-- Soft-delete public.users when auth user is deleted
CREATE OR REPLACE FUNCTION handle_auth_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users SET deleted_at = now() WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_auth_user_deleted();
