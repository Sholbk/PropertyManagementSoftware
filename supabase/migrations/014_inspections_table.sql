-- ============================================================================
-- INSPECTIONS TABLE + RLS
-- ============================================================================
-- Supports move-in, move-out, routine, safety, and annual inspections.
-- Triggers notify on failed inspections.
-- ============================================================================

-- ============================================================================
-- 1. INSPECTION TYPE ENUM
-- ============================================================================
CREATE TYPE inspection_type AS ENUM (
    'move_in', 'move_out', 'routine', 'safety', 'annual'
);

CREATE TYPE inspection_status AS ENUM (
    'scheduled', 'in_progress', 'passed', 'failed', 'needs_followup'
);

CREATE TYPE inspection_result AS ENUM (
    'pass', 'fail', 'conditional'
);

-- ============================================================================
-- 2. INSPECTIONS TABLE
-- ============================================================================
CREATE TABLE inspections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    property_id         UUID NOT NULL REFERENCES properties(id),
    unit_id             UUID REFERENCES units(id),
    inspection_type     inspection_type NOT NULL,
    status              inspection_status NOT NULL DEFAULT 'scheduled',
    inspector_id        UUID REFERENCES users(id),
    scheduled_date      DATE NOT NULL,
    completed_date      DATE,
    overall_result      inspection_result,
    findings            JSONB NOT NULL DEFAULT '[]',
    photos              TEXT[] NOT NULL DEFAULT '{}',
    notes               TEXT,
    follow_up_required  BOOLEAN NOT NULL DEFAULT FALSE,
    follow_up_deadline  DATE,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- Apply updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inspections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
CREATE INDEX idx_inspections_org ON inspections(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_property ON inspections(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_unit ON inspections(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_status ON inspections(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_scheduled ON inspections(scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_inspector ON inspections(inspector_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_failed ON inspections(organization_id, property_id)
    WHERE status = 'failed' AND deleted_at IS NULL;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- All org members can view inspections
CREATE POLICY "org members can view inspections" ON inspections
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
    );

-- Managers and owners can create inspections
CREATE POLICY "managers can create inspections" ON inspections
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

-- Managers and inspectors can update inspections
CREATE POLICY "managers and inspectors can update inspections" ON inspections
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND (
            auth_has_role(ARRAY['owner', 'property_manager'])
            OR inspector_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (
            auth_has_role(ARRAY['owner', 'property_manager'])
            OR inspector_id = auth.uid()
        )
    );

-- Only owners can delete (soft delete)
CREATE POLICY "owners can delete inspections" ON inspections
    FOR DELETE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner'])
    );
