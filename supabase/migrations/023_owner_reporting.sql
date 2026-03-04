-- ============================================================================
-- 023_owner_reporting.sql — Owner report configs and generated reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS owner_report_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    property_id         UUID REFERENCES properties(id),
    report_type         TEXT NOT NULL DEFAULT 'monthly'
                        CHECK (report_type IN ('monthly', 'quarterly', 'annual')),
    recipients          TEXT[] NOT NULL DEFAULT '{}',
    include_sections    TEXT[] NOT NULL DEFAULT ARRAY[
                            'financial_summary', 'occupancy', 'maintenance', 'leasing'
                        ],
    include_benchmarks  BOOLEAN DEFAULT false,
    is_active           BOOLEAN DEFAULT true,
    last_sent_at        TIMESTAMPTZ,
    next_send_date      DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orc_org
  ON owner_report_configs(organization_id) WHERE is_active = true;

ALTER TABLE owner_report_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers view report configs" ON owner_report_configs
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE POLICY "managers manage report configs" ON owner_report_configs
    FOR ALL USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON owner_report_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Generated Reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS owner_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    config_id           UUID NOT NULL REFERENCES owner_report_configs(id),
    property_id         UUID REFERENCES properties(id),
    period_type         TEXT NOT NULL,
    period_date         DATE NOT NULL,
    report_url          TEXT NOT NULL,
    sent_to             TEXT[] DEFAULT '{}',
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_or_org
  ON owner_reports(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_or_config
  ON owner_reports(config_id, period_date DESC);

ALTER TABLE owner_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers view reports" ON owner_reports
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );
