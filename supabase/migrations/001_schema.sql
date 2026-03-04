-- ============================================================================
-- PROPERTY MANAGEMENT PERFORMANCE PLATFORM — DATABASE SCHEMA
-- PostgreSQL 16+ | Multi-tenant via RLS | Soft deletes | Full audit trail
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy text search

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================
CREATE TYPE user_role AS ENUM (
    'owner', 'property_manager', 'maintenance_tech',
    'leasing_agent', 'accounting', 'vendor_user'
);

CREATE TYPE property_type AS ENUM (
    'single_family', 'multi_family', 'commercial', 'mixed_use', 'industrial'
);

CREATE TYPE unit_status AS ENUM (
    'vacant', 'occupied', 'maintenance', 'renovation', 'off_market'
);

CREATE TYPE lease_status AS ENUM (
    'draft', 'pending_signature', 'active', 'month_to_month',
    'expired', 'terminated', 'renewed'
);

CREATE TYPE work_order_priority AS ENUM ('emergency', 'high', 'medium', 'low');

CREATE TYPE work_order_status AS ENUM (
    'open', 'assigned', 'in_progress', 'pending_parts',
    'pending_vendor', 'completed', 'closed', 'cancelled'
);

CREATE TYPE transaction_type AS ENUM (
    'rent_payment', 'security_deposit', 'late_fee', 'pet_fee',
    'parking_fee', 'utility_charge', 'maintenance_expense',
    'vendor_payment', 'insurance', 'tax', 'management_fee',
    'capex', 'refund', 'adjustment', 'other_income', 'other_expense'
);

CREATE TYPE transaction_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded', 'voided'
);

CREATE TYPE ai_action_type AS ENUM (
    'classification', 'recommendation', 'generation', 'analysis',
    'prediction', 'automation', 'chat_response'
);

-- ============================================================================
-- 1. ORGANIZATIONS (top-level tenant)
-- ============================================================================
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,              -- subdomain: acme.pmpp.io
    plan            TEXT NOT NULL DEFAULT 'starter',   -- starter | pro | enterprise
    domain          TEXT,                              -- custom domain
    logo_url        TEXT,
    timezone        TEXT NOT NULL DEFAULT 'America/Chicago',
    settings        JSONB NOT NULL DEFAULT '{}',       -- branding, feature flags, defaults
    subscription_status TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ                        -- soft delete
);

CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. USERS
-- ============================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    email           TEXT NOT NULL,
    password_hash   TEXT,                              -- NULL if SSO-only
    full_name       TEXT NOT NULL,
    role            user_role NOT NULL,
    phone           TEXT,
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    invited_at      TIMESTAMPTZ,
    onboarded_at    TIMESTAMPTZ,
    settings        JSONB NOT NULL DEFAULT '{}',       -- notification prefs, UI prefs
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_email_per_org ON users(org_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_org_role ON users(org_id, role) WHERE deleted_at IS NULL;

-- Granular permissions beyond base role
CREATE TABLE user_property_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id     UUID NOT NULL,  -- FK added after properties table
    permissions     TEXT[] NOT NULL DEFAULT '{}',  -- ['read','write','approve','financial']
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. PROPERTIES
-- ============================================================================
CREATE TABLE properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    property_type   property_type NOT NULL,
    address_line1   TEXT NOT NULL,
    address_line2   TEXT,
    city            TEXT NOT NULL,
    state           TEXT NOT NULL,
    zip             TEXT NOT NULL,
    county          TEXT,
    latitude        NUMERIC(10, 7),
    longitude       NUMERIC(10, 7),
    year_built      SMALLINT,
    total_units     INT NOT NULL DEFAULT 1,
    total_sqft      INT,
    manager_id      UUID REFERENCES users(id),
    purchase_price  NUMERIC(14, 2),
    purchase_date   DATE,
    tax_parcel_id   TEXT,
    insurance_policy TEXT,
    notes           TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_properties_org ON properties(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_manager ON properties(org_id, manager_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_geo ON properties(state, city) WHERE deleted_at IS NULL;

-- Now add the FK we deferred
ALTER TABLE user_property_assignments
    ADD CONSTRAINT fk_upa_property FOREIGN KEY (property_id) REFERENCES properties(id);

CREATE UNIQUE INDEX idx_upa_unique ON user_property_assignments(user_id, property_id);
CREATE INDEX idx_upa_property ON user_property_assignments(org_id, property_id);

-- ============================================================================
-- 4. UNITS
-- ============================================================================
CREATE TABLE units (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    property_id     UUID NOT NULL REFERENCES properties(id),
    unit_number     TEXT NOT NULL,
    floor           SMALLINT,
    bedrooms        SMALLINT,
    bathrooms       NUMERIC(3, 1),
    sqft            INT,
    unit_type       TEXT,                              -- studio | 1br | 2br | commercial
    market_rent     NUMERIC(10, 2),                    -- current market rate
    status          unit_status NOT NULL DEFAULT 'vacant',
    amenities       TEXT[] DEFAULT '{}',                -- ['washer_dryer','balcony','garage']
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_units_number_per_property
    ON units(property_id, unit_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_units_org_property ON units(org_id, property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_units_status ON units(org_id, status) WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. TENANTS (residents / lessees)
-- ============================================================================
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    date_of_birth   DATE,
    ssn_encrypted   BYTEA,                             -- pgcrypto encrypted
    drivers_license TEXT,
    credit_score    SMALLINT,
    income_annual   NUMERIC(12, 2),
    employer        TEXT,
    emergency_contact_name  TEXT,
    emergency_contact_phone TEXT,
    portal_user_id  UUID REFERENCES users(id),         -- if tenant has portal access
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_tenants_org ON tenants(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_name ON tenants(org_id, last_name, first_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_email ON tenants(org_id, email) WHERE deleted_at IS NULL AND email IS NOT NULL;

-- ============================================================================
-- 6. LEASES (with history tracking)
-- ============================================================================
CREATE TABLE leases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    unit_id         UUID NOT NULL REFERENCES units(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    lease_type      TEXT NOT NULL DEFAULT 'fixed',     -- fixed | month_to_month
    status          lease_status NOT NULL DEFAULT 'draft',
    start_date      DATE NOT NULL,
    end_date        DATE,                              -- NULL for month-to-month
    monthly_rent    NUMERIC(10, 2) NOT NULL,
    security_deposit NUMERIC(10, 2),
    pet_deposit     NUMERIC(10, 2),
    late_fee_amount NUMERIC(8, 2),
    late_fee_grace_days SMALLINT DEFAULT 5,
    rent_due_day    SMALLINT NOT NULL DEFAULT 1,       -- day of month rent is due
    escalation_pct  NUMERIC(5, 2),                     -- annual rent increase %
    terms           JSONB NOT NULL DEFAULT '{}',       -- parking, utilities, pet policy
    document_urls   TEXT[] DEFAULT '{}',                -- S3 paths to signed docs
    previous_lease_id UUID REFERENCES leases(id),      -- chain for renewals
    signed_at       TIMESTAMPTZ,
    terminated_at   TIMESTAMPTZ,
    termination_reason TEXT,
    move_in_date    DATE,
    move_out_date   DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_leases_unit ON leases(org_id, unit_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leases_tenant ON leases(org_id, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leases_status ON leases(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leases_expiring ON leases(org_id, end_date)
    WHERE deleted_at IS NULL AND status IN ('active', 'month_to_month');

-- Tracks every change to a lease for auditing & historical KPI computation
CREATE TABLE lease_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    lease_id        UUID NOT NULL REFERENCES leases(id),
    changed_by      UUID NOT NULL REFERENCES users(id),
    field_name      TEXT NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    change_reason   TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lease_history_lease ON lease_history(lease_id, changed_at DESC);
CREATE INDEX idx_lease_history_org ON lease_history(org_id, changed_at DESC);

-- ============================================================================
-- 7. VENDORS
-- ============================================================================
CREATE TABLE vendors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    company_name    TEXT NOT NULL,
    contact_name    TEXT,
    email           TEXT,
    phone           TEXT,
    address         TEXT,
    specialties     TEXT[] NOT NULL DEFAULT '{}',       -- ['plumbing','hvac','electrical']
    hourly_rate     NUMERIC(8, 2),
    flat_rate_fees  JSONB DEFAULT '{}',                 -- {"drain_clearing": 150.00}
    rating_avg      NUMERIC(3, 2) DEFAULT 0,           -- computed from work orders
    rating_count    INT DEFAULT 0,
    insurance_provider TEXT,
    insurance_policy_number TEXT,
    insurance_expiry DATE,
    license_number  TEXT,
    w9_on_file      BOOLEAN DEFAULT false,
    is_preferred    BOOLEAN DEFAULT false,
    portal_user_id  UUID REFERENCES users(id),         -- vendor portal access
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_vendors_org ON vendors(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_specialties ON vendors USING GIN (specialties) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_preferred ON vendors(org_id, is_preferred)
    WHERE deleted_at IS NULL AND is_preferred = true;

-- ============================================================================
-- 8. WORK ORDERS (maintenance requests + assigned work)
-- ============================================================================
CREATE TABLE work_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    property_id     UUID NOT NULL REFERENCES properties(id),
    unit_id         UUID REFERENCES units(id),         -- NULL for common-area work
    lease_id        UUID REFERENCES leases(id),
    reported_by_tenant_id UUID REFERENCES tenants(id),
    reported_by_user_id   UUID REFERENCES users(id),
    assigned_to     UUID REFERENCES users(id),         -- internal tech
    vendor_id       UUID REFERENCES vendors(id),       -- external vendor

    title           TEXT NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL,                      -- plumbing, electrical, hvac, etc.
    priority        work_order_priority NOT NULL DEFAULT 'medium',
    status          work_order_status NOT NULL DEFAULT 'open',

    -- Scheduling
    scheduled_date  DATE,
    scheduled_window TEXT,                             -- 'morning' | 'afternoon' | '9am-12pm'
    entry_permitted BOOLEAN DEFAULT true,              -- can tech enter if tenant absent?
    entry_notes     TEXT,

    -- Resolution
    resolution_notes TEXT,
    parts_used      JSONB DEFAULT '[]',                -- [{"name":"faucet","cost":45.00}]
    labor_hours     NUMERIC(6, 2),
    material_cost   NUMERIC(10, 2) DEFAULT 0,
    labor_cost      NUMERIC(10, 2) DEFAULT 0,
    total_cost      NUMERIC(10, 2) GENERATED ALWAYS AS (
                        COALESCE(material_cost, 0) + COALESCE(labor_cost, 0)
                    ) STORED,

    -- Tenant feedback
    tenant_rating   SMALLINT CHECK (tenant_rating BETWEEN 1 AND 5),
    tenant_feedback TEXT,

    -- AI fields
    ai_category_suggestion    TEXT,
    ai_priority_score         NUMERIC(4, 3),           -- 0.000 - 1.000
    ai_vendor_suggestion_id   UUID REFERENCES vendors(id),
    ai_estimated_cost         NUMERIC(10, 2),

    -- Timestamps
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_at     TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_wo_org_status ON work_orders(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_property ON work_orders(org_id, property_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_assigned ON work_orders(org_id, assigned_to, status)
    WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;
CREATE INDEX idx_wo_vendor ON work_orders(org_id, vendor_id)
    WHERE deleted_at IS NULL AND vendor_id IS NOT NULL;
CREATE INDEX idx_wo_priority ON work_orders(org_id, priority, status)
    WHERE deleted_at IS NULL AND status NOT IN ('completed', 'closed', 'cancelled');
CREATE INDEX idx_wo_reported_at ON work_orders(org_id, reported_at DESC) WHERE deleted_at IS NULL;
-- For KPI: avg completion time
CREATE INDEX idx_wo_completion ON work_orders(org_id, property_id, reported_at, completed_at)
    WHERE deleted_at IS NULL AND completed_at IS NOT NULL;

-- Work order photo/file attachments
CREATE TABLE work_order_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    file_url        TEXT NOT NULL,
    file_type       TEXT NOT NULL,                     -- image/jpeg, application/pdf
    file_size_bytes INT,
    caption         TEXT,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    stage           TEXT NOT NULL DEFAULT 'before',    -- before | during | after
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wo_attachments ON work_order_attachments(work_order_id);

-- Work order status change log (for SLA tracking)
CREATE TABLE work_order_status_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    work_order_id   UUID NOT NULL REFERENCES work_orders(id),
    old_status      work_order_status,
    new_status      work_order_status NOT NULL,
    changed_by      UUID NOT NULL REFERENCES users(id),
    notes           TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wo_status_log ON work_order_status_log(work_order_id, changed_at DESC);

-- ============================================================================
-- 9. FINANCIAL TRANSACTIONS
-- ============================================================================
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    property_id     UUID NOT NULL REFERENCES properties(id),
    unit_id         UUID REFERENCES units(id),
    lease_id        UUID REFERENCES leases(id),
    tenant_id       UUID REFERENCES tenants(id),
    vendor_id       UUID REFERENCES vendors(id),
    work_order_id   UUID REFERENCES work_orders(id),

    type            transaction_type NOT NULL,
    status          transaction_status NOT NULL DEFAULT 'pending',
    category        TEXT NOT NULL,                     -- GL account category
    description     TEXT,

    -- Amounts: positive = income to property, negative = expense
    amount          NUMERIC(12, 2) NOT NULL,
    tax_amount      NUMERIC(10, 2) DEFAULT 0,

    -- Dates
    transaction_date DATE NOT NULL,
    due_date        DATE,
    paid_date       DATE,
    period_start    DATE,                              -- for recurring charges
    period_end      DATE,

    -- Payment details
    payment_method  TEXT,                               -- ach | check | card | cash | wire
    check_number    TEXT,
    reference_number TEXT,                              -- external payment ref

    -- Integration refs
    stripe_payment_id TEXT,
    quickbooks_id   TEXT,

    -- Reconciliation
    is_reconciled   BOOLEAN NOT NULL DEFAULT false,
    reconciled_at   TIMESTAMPTZ,
    reconciled_by   UUID REFERENCES users(id),

    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_txn_org_property ON transactions(org_id, property_id, transaction_date DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_txn_org_type ON transactions(org_id, type, transaction_date DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_txn_lease ON transactions(org_id, lease_id, transaction_date DESC)
    WHERE deleted_at IS NULL AND lease_id IS NOT NULL;
CREATE INDEX idx_txn_tenant ON transactions(org_id, tenant_id)
    WHERE deleted_at IS NULL AND tenant_id IS NOT NULL;
CREATE INDEX idx_txn_vendor ON transactions(org_id, vendor_id)
    WHERE deleted_at IS NULL AND vendor_id IS NOT NULL;
CREATE INDEX idx_txn_outstanding ON transactions(org_id, due_date)
    WHERE deleted_at IS NULL AND status = 'pending' AND due_date IS NOT NULL;
-- For KPI: monthly income/expense rollups
CREATE INDEX idx_txn_period ON transactions(org_id, property_id, type, transaction_date)
    WHERE deleted_at IS NULL AND status = 'completed';

-- ============================================================================
-- 10. AI AGENT ACTIVITY LOGS
-- ============================================================================
CREATE TABLE ai_activity_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID REFERENCES users(id),         -- NULL for system-triggered
    action_type     ai_action_type NOT NULL,
    domain          TEXT NOT NULL,                      -- maintenance | leasing | financial | general
    context_entity  TEXT,                               -- 'work_order' | 'lease' | 'transaction'
    context_id      UUID,                               -- FK to relevant record

    -- Request/Response
    input_summary   TEXT NOT NULL,                      -- truncated prompt (no PII)
    output_summary  TEXT NOT NULL,                      -- truncated response
    full_prompt     TEXT,                               -- stored only if org settings allow
    full_response   TEXT,

    -- Model info
    model_provider  TEXT NOT NULL,                      -- anthropic | openai
    model_id        TEXT NOT NULL,                      -- claude-sonnet-4-6 | gpt-4o
    tokens_input    INT,
    tokens_output   INT,
    latency_ms      INT,
    cost_usd        NUMERIC(8, 6),

    -- Outcome tracking
    suggestion_accepted BOOLEAN,                       -- did user accept the suggestion?
    feedback        TEXT,                               -- thumbs_up | thumbs_down | text

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No soft delete on logs — append only
CREATE INDEX idx_ai_log_org ON ai_activity_logs(org_id, created_at DESC);
CREATE INDEX idx_ai_log_domain ON ai_activity_logs(org_id, domain, created_at DESC);
CREATE INDEX idx_ai_log_context ON ai_activity_logs(org_id, context_entity, context_id)
    WHERE context_id IS NOT NULL;
CREATE INDEX idx_ai_log_acceptance ON ai_activity_logs(org_id, action_type, suggestion_accepted)
    WHERE suggestion_accepted IS NOT NULL;

-- ============================================================================
-- 11. PERFORMANCE METRIC SNAPSHOTS
-- ============================================================================
-- Pre-computed KPIs stored daily/weekly/monthly via background job.
-- Raw data stays in source tables; snapshots enable fast dashboard queries.

CREATE TABLE metric_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    property_id     UUID REFERENCES properties(id),    -- NULL = portfolio-level
    unit_id         UUID REFERENCES units(id),         -- NULL = property or portfolio level
    period_type     TEXT NOT NULL,                      -- daily | weekly | monthly | quarterly
    period_date     DATE NOT NULL,                     -- first day of period

    -- Revenue & Income
    gross_potential_rent     NUMERIC(12, 2),            -- sum(market_rent) for all units
    effective_gross_income   NUMERIC(12, 2),            -- actual collected
    vacancy_loss             NUMERIC(12, 2),            -- GPR - EGI from vacancies
    concessions              NUMERIC(12, 2),
    other_income             NUMERIC(12, 2),

    -- Expenses
    operating_expenses       NUMERIC(12, 2),
    maintenance_costs        NUMERIC(12, 2),
    management_fees          NUMERIC(12, 2),
    insurance_costs          NUMERIC(12, 2),
    tax_costs                NUMERIC(12, 2),
    capex                    NUMERIC(12, 2),

    -- Calculated KPIs
    noi                      NUMERIC(12, 2),            -- EGI - operating_expenses
    vacancy_rate             NUMERIC(6, 4),             -- 0.0000 to 1.0000
    occupancy_rate           NUMERIC(6, 4),             -- 1 - vacancy_rate
    avg_rent_per_unit        NUMERIC(10, 2),
    revenue_per_sqft         NUMERIC(10, 4),
    expense_ratio            NUMERIC(6, 4),             -- opex / EGI
    rent_collection_rate     NUMERIC(6, 4),             -- collected / billed
    delinquency_rate         NUMERIC(6, 4),

    -- Maintenance KPIs
    work_orders_opened       INT,
    work_orders_completed    INT,
    avg_completion_hours     NUMERIC(10, 2),            -- avg time to complete
    maintenance_cost_per_unit NUMERIC(10, 2),
    emergency_wo_count       INT,
    avg_tenant_satisfaction  NUMERIC(3, 2),             -- avg of tenant_rating

    -- Leasing KPIs
    leases_expiring          INT,
    leases_renewed           INT,
    new_leases_signed        INT,
    tenant_retention_rate    NUMERIC(6, 4),
    avg_days_to_lease        NUMERIC(8, 2),             -- vacant to signed
    avg_rent_growth_pct      NUMERIC(6, 4),             -- renewal rent vs prior

    -- Unit counts
    total_units              INT,
    occupied_units           INT,
    vacant_units             INT,

    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary lookup: dashboard queries by org, property, period
CREATE UNIQUE INDEX idx_metrics_unique
    ON metric_snapshots(org_id, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'),
                        COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'),
                        period_type, period_date);
CREATE INDEX idx_metrics_org_period ON metric_snapshots(org_id, period_type, period_date DESC);
CREATE INDEX idx_metrics_property ON metric_snapshots(org_id, property_id, period_type, period_date DESC)
    WHERE property_id IS NOT NULL;

-- ============================================================================
-- 12. AUDIT LOG (immutable, append-only)
-- ============================================================================
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    user_id         UUID,                              -- NULL for system actions
    action          TEXT NOT NULL,                      -- create | update | delete | restore | login
    entity_type     TEXT NOT NULL,                      -- 'property' | 'lease' | 'work_order' etc.
    entity_id       UUID NOT NULL,
    old_values      JSONB,                             -- previous state (on update/delete)
    new_values      JSONB,                             -- new state (on create/update)
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No soft delete, no update — append only
CREATE INDEX idx_audit_org ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(org_id, entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(org_id, user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

-- ============================================================================
-- 13. NOTIFICATIONS
-- ============================================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    body            TEXT,
    channel         TEXT NOT NULL DEFAULT 'in_app',    -- in_app | email | sms | push
    entity_type     TEXT,
    entity_id       UUID,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    read_at         TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(org_id, user_id, is_read, created_at DESC);

-- ============================================================================
-- 14. ROW-LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_property_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy pattern: app sets current_setting('app.current_org_id') per-request
-- Every table with org_id gets the same policy shape.

CREATE POLICY org_isolation ON organizations
    USING (id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON users
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON user_property_assignments
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON properties
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON units
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON tenants
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON leases
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON lease_history
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON vendors
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON work_orders
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON work_order_attachments
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON work_order_status_log
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON transactions
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON ai_activity_logs
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON metric_snapshots
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON audit_log
    USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON notifications
    USING (org_id = current_setting('app.current_org_id')::UUID);

-- ============================================================================
-- 15. TRIGGER: auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all mutable tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'organizations', 'users', 'properties', 'units',
            'tenants', 'leases', 'vendors', 'work_orders', 'transactions'
        ])
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ============================================================================
-- 16. TRIGGER: audit log on lease changes
-- ============================================================================
CREATE OR REPLACE FUNCTION log_lease_changes()
RETURNS TRIGGER AS $$
DECLARE
    col TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Track specific fields that matter for KPI history
    FOREACH col IN ARRAY ARRAY[
        'status', 'monthly_rent', 'end_date', 'lease_type',
        'security_deposit', 'escalation_pct'
    ]
    LOOP
        EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', col, col)
            INTO old_val, new_val
            USING OLD, NEW;

        IF old_val IS DISTINCT FROM new_val THEN
            INSERT INTO lease_history (org_id, lease_id, changed_by, field_name, old_value, new_value)
            VALUES (
                NEW.org_id,
                NEW.id,
                COALESCE(
                    NULLIF(current_setting('app.current_user_id', true), ''),
                    '00000000-0000-0000-0000-000000000000'
                )::UUID,
                col,
                old_val,
                new_val
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lease_history
    AFTER UPDATE ON leases
    FOR EACH ROW
    EXECUTE FUNCTION log_lease_changes();
