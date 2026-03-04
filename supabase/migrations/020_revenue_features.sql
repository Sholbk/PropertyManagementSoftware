-- ============================================================================
-- 020_revenue_features.sql — Core billing infrastructure
-- Adds Stripe billing columns to organizations, subscription event log,
-- and AI usage quota tracking.
-- ============================================================================

-- Billing columns on organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS plan_limits             JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS billing_email           TEXT,
  ADD COLUMN IF NOT EXISTS add_ons                 TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_orgs_stripe
  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- Subscription Events — Stripe webhook log
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    stripe_event_id     TEXT NOT NULL UNIQUE,
    event_type          TEXT NOT NULL,
    payload             JSONB NOT NULL,
    processed_at        TIMESTAMPTZ,
    error               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_org
  ON subscription_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_events_stripe
  ON subscription_events(stripe_event_id);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view sub events" ON subscription_events
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner'])
    );

-- ============================================================================
-- AI Usage Quotas — tier-aware tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_quotas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    calls_used          INT NOT NULL DEFAULT 0,
    calls_limit         INT NOT NULL,
    tokens_used         INT NOT NULL DEFAULT 0,
    tokens_limit        INT,
    cost_usd_used       NUMERIC(10, 6) NOT NULL DEFAULT 0,
    cost_usd_limit      NUMERIC(10, 6),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aiq_org_period
  ON ai_usage_quotas(organization_id, period_start);
CREATE INDEX IF NOT EXISTS idx_aiq_active
  ON ai_usage_quotas(organization_id, period_end DESC);

ALTER TABLE ai_usage_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers view quotas" ON ai_usage_quotas
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

-- Updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_usage_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
