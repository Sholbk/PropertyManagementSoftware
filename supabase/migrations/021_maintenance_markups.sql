-- ============================================================================
-- 021_maintenance_markups.sql — Maintenance markup tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_markups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    work_order_id       UUID NOT NULL REFERENCES work_orders(id),
    vendor_cost         NUMERIC(10, 2) NOT NULL,
    owner_charge        NUMERIC(10, 2) NOT NULL,
    markup_amount       NUMERIC(10, 2) GENERATED ALWAYS AS (owner_charge - vendor_cost) STORED,
    markup_pct          NUMERIC(6, 4) GENERATED ALWAYS AS (
                            CASE WHEN vendor_cost > 0
                            THEN (owner_charge - vendor_cost) / vendor_cost
                            ELSE 0 END
                        ) STORED,
    notes               TEXT,
    invoice_number      TEXT,
    billed_to           TEXT CHECK (billed_to IN ('owner', 'tenant', 'property')),
    transaction_id      UUID REFERENCES financial_transactions(id),
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_wo
  ON maintenance_markups(work_order_id);
CREATE INDEX IF NOT EXISTS idx_mm_org
  ON maintenance_markups(organization_id, created_at DESC);

ALTER TABLE maintenance_markups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance roles view markups" ON maintenance_markups
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'accounting'])
    );

CREATE POLICY "managers create markups" ON maintenance_markups
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE POLICY "managers update markups" ON maintenance_markups
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON maintenance_markups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
