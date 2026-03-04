-- ============================================================================
-- RLS POLICIES — Supabase Auth JWT-based
-- ============================================================================
-- Every policy reads org_id and role from:
--   auth.jwt() -> 'app_metadata' ->> 'org_id'
--   auth.jwt() -> 'app_metadata' ->> 'role'
--
-- Supabase Auth embeds raw_app_meta_data into the JWT automatically.
-- ============================================================================

-- Helper function to extract org_id from JWT (avoids repetition)
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to extract role from JWT
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_own" ON organizations
    FOR SELECT USING (id = auth_org_id());

CREATE POLICY "org_update_owner" ON organizations
    FOR UPDATE USING (id = auth_org_id() AND auth_role() = 'owner')
    WITH CHECK (id = auth_org_id() AND auth_role() = 'owner');

-- ============================================================================
-- USERS
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_org" ON users
    FOR SELECT USING (org_id = auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "users_insert_owner" ON users
    FOR INSERT WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() = 'owner'
    );

CREATE POLICY "users_update" ON users
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND (auth_role() = 'owner' OR id = auth.uid())
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND (auth_role() = 'owner' OR id = auth.uid())
    );

CREATE POLICY "users_delete_owner" ON users
    FOR DELETE USING (
        org_id = auth_org_id()
        AND auth_role() = 'owner'
        AND id != auth.uid()  -- can't delete yourself
    );

-- ============================================================================
-- USER PROPERTY ASSIGNMENTS
-- ============================================================================
ALTER TABLE user_property_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upa_select" ON user_property_assignments
    FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "upa_manage" ON user_property_assignments
    FOR ALL USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

-- ============================================================================
-- PROPERTIES
-- ============================================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Everyone in the org can see properties (techs filtered by assignment in app layer)
CREATE POLICY "properties_select" ON properties
    FOR SELECT USING (org_id = auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "properties_insert" ON properties
    FOR INSERT WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

CREATE POLICY "properties_update" ON properties
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

CREATE POLICY "properties_delete" ON properties
    FOR DELETE USING (
        org_id = auth_org_id()
        AND auth_role() = 'owner'
    );

-- ============================================================================
-- UNITS
-- ============================================================================
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_select" ON units
    FOR SELECT USING (org_id = auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "units_insert" ON units
    FOR INSERT WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

CREATE POLICY "units_update" ON units
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

-- ============================================================================
-- TENANTS (residents)
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select" ON tenants
    FOR SELECT USING (org_id = auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "tenants_insert" ON tenants
    FOR INSERT WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager', 'leasing_agent')
    );

CREATE POLICY "tenants_update" ON tenants
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager', 'leasing_agent')
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager', 'leasing_agent')
    );

-- ============================================================================
-- LEASES
-- ============================================================================
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leases_select" ON leases
    FOR SELECT USING (
        org_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_role() IN ('owner', 'property_manager', 'leasing_agent', 'accounting')
    );

CREATE POLICY "leases_insert" ON leases
    FOR INSERT WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager', 'leasing_agent')
    );

CREATE POLICY "leases_update" ON leases
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager', 'leasing_agent')
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager', 'leasing_agent')
    );

-- ============================================================================
-- LEASE HISTORY (read-only for users, written by trigger)
-- ============================================================================
ALTER TABLE lease_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_history_select" ON lease_history
    FOR SELECT USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

-- INSERT is done by the trigger (runs as SECURITY DEFINER), not by users

-- ============================================================================
-- VENDORS
-- ============================================================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select" ON vendors
    FOR SELECT USING (org_id = auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "vendors_insert" ON vendors
    FOR INSERT WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

CREATE POLICY "vendors_update" ON vendors
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

-- Vendor users can see their own vendor record
CREATE POLICY "vendors_self_select" ON vendors
    FOR SELECT USING (
        org_id = auth_org_id()
        AND auth_role() = 'vendor_user'
        AND portal_user_id = auth.uid()
    );

-- ============================================================================
-- WORK ORDERS
-- ============================================================================
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Owner + PM see all org work orders
CREATE POLICY "wo_select_managers" ON work_orders
    FOR SELECT USING (
        org_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_role() IN ('owner', 'property_manager', 'leasing_agent', 'accounting')
    );

-- Maintenance techs see only assigned work orders
CREATE POLICY "wo_select_tech" ON work_orders
    FOR SELECT USING (
        org_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_role() = 'maintenance_tech'
        AND assigned_to = auth.uid()
    );

-- Vendor users see only their assigned work orders
CREATE POLICY "wo_select_vendor" ON work_orders
    FOR SELECT USING (
        org_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_role() = 'vendor_user'
        AND vendor_id IN (SELECT id FROM vendors WHERE portal_user_id = auth.uid())
    );

-- Anyone in org can create a work order (residents via portal too)
CREATE POLICY "wo_insert" ON work_orders
    FOR INSERT WITH CHECK (org_id = auth_org_id());

-- Techs can update assigned work orders (status, resolution, cost)
CREATE POLICY "wo_update_tech" ON work_orders
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND auth_role() = 'maintenance_tech'
        AND assigned_to = auth.uid()
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() = 'maintenance_tech'
        AND assigned_to = auth.uid()
    );

-- Managers can update any work order in org
CREATE POLICY "wo_update_managers" ON work_orders
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

-- ============================================================================
-- WORK ORDER ATTACHMENTS
-- ============================================================================
ALTER TABLE work_order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wo_attach_select" ON work_order_attachments
    FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "wo_attach_insert" ON work_order_attachments
    FOR INSERT WITH CHECK (org_id = auth_org_id());

-- ============================================================================
-- WORK ORDER STATUS LOG
-- ============================================================================
ALTER TABLE work_order_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wo_log_select" ON work_order_status_log
    FOR SELECT USING (org_id = auth_org_id());

-- INSERT done by application/triggers, not restricted by role

CREATE POLICY "wo_log_insert" ON work_order_status_log
    FOR INSERT WITH CHECK (org_id = auth_org_id());

-- ============================================================================
-- TRANSACTIONS (financial — restricted access)
-- ============================================================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "txn_select" ON transactions
    FOR SELECT USING (
        org_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_role() IN ('owner', 'property_manager', 'accounting')
    );

CREATE POLICY "txn_insert" ON transactions
    FOR INSERT WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'accounting')
    );

CREATE POLICY "txn_update" ON transactions
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'accounting')
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'accounting')
    );

-- ============================================================================
-- AI ACTIVITY LOGS (read-only for users, written by edge functions)
-- ============================================================================
ALTER TABLE ai_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_logs_select" ON ai_activity_logs
    FOR SELECT USING (
        org_id = auth_org_id()
        AND auth_role() IN ('owner', 'property_manager')
    );

-- INSERT is done by Edge Functions using service_role key (bypasses RLS)

-- ============================================================================
-- METRIC SNAPSHOTS (read-only for users, written by compute job)
-- ============================================================================
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metrics_select" ON metric_snapshots
    FOR SELECT USING (org_id = auth_org_id());

-- INSERT/UPDATE done by compute-metrics Edge Function using service_role

-- ============================================================================
-- AUDIT LOG (owner-only read, written by triggers)
-- ============================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_owner" ON audit_log
    FOR SELECT USING (
        org_id = auth_org_id()
        AND auth_role() = 'owner'
    );

-- INSERT done by triggers (SECURITY DEFINER)

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY "notif_select_own" ON notifications
    FOR SELECT USING (
        org_id = auth_org_id()
        AND user_id = auth.uid()
    );

-- Users can mark their own notifications as read
CREATE POLICY "notif_update_own" ON notifications
    FOR UPDATE USING (
        org_id = auth_org_id()
        AND user_id = auth.uid()
    )
    WITH CHECK (
        org_id = auth_org_id()
        AND user_id = auth.uid()
    );

-- INSERT done by Edge Functions using service_role
