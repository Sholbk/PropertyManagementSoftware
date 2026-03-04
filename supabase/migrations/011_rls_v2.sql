-- ============================================================================
-- RLS POLICIES v2 — Membership-based (supports multi-org users)
-- ============================================================================
-- All policies use auth_org_id() and auth_has_role() from the schema.
-- A user's active org is set in their JWT app_metadata.active_org_id.
-- Their role is looked up from the memberships table.
-- ============================================================================

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view their org" ON organizations
    FOR SELECT USING (
        id = auth_org_id()
    );

CREATE POLICY "owners can update their org" ON organizations
    FOR UPDATE USING (
        id = auth_org_id() AND auth_has_role(ARRAY['owner'])
    )
    WITH CHECK (
        id = auth_org_id() AND auth_has_role(ARRAY['owner'])
    );

-- ============================================================================
-- USERS
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can see other users in the same org (via membership)
CREATE POLICY "org members can view users" ON users
    FOR SELECT USING (
        deleted_at IS NULL
        AND id IN (
            SELECT user_id FROM memberships
            WHERE organization_id = auth_org_id() AND status = 'active'
        )
    );

-- Users can update their own profile
CREATE POLICY "users can update self" ON users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================================================
-- MEMBERSHIPS
-- ============================================================================
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- See memberships in your active org
CREATE POLICY "view org memberships" ON memberships
    FOR SELECT USING (organization_id = auth_org_id());

-- See your own memberships across all orgs (for org switcher)
CREATE POLICY "view own memberships" ON memberships
    FOR SELECT USING (user_id = auth.uid());

-- Only owners can manage memberships
CREATE POLICY "owners manage memberships" ON memberships
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id() AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE POLICY "owners update memberships" ON memberships
    FOR UPDATE USING (
        organization_id = auth_org_id() AND auth_has_role(ARRAY['owner'])
    )
    WITH CHECK (
        organization_id = auth_org_id() AND auth_has_role(ARRAY['owner'])
    );

CREATE POLICY "owners delete memberships" ON memberships
    FOR DELETE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner'])
        AND user_id != auth.uid()
    );

-- ============================================================================
-- PROPERTIES
-- ============================================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view properties" ON properties
    FOR SELECT USING (organization_id = auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "managers create properties" ON properties
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE POLICY "managers update properties" ON properties
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE POLICY "owners delete properties" ON properties
    FOR DELETE USING (
        organization_id = auth_org_id() AND auth_has_role(ARRAY['owner'])
    );

-- ============================================================================
-- UNITS
-- ============================================================================
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view units" ON units
    FOR SELECT USING (organization_id = auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "managers manage units" ON units
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE POLICY "managers update units" ON units
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

-- ============================================================================
-- TENANTS
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff view tenants" ON tenants
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_has_role(ARRAY['owner', 'property_manager', 'leasing_agent', 'accounting'])
    );

-- Residents can see their own record
CREATE POLICY "residents view self" ON tenants
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND user_id = auth.uid()
    );

CREATE POLICY "leasing manages tenants" ON tenants
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'leasing_agent'])
    );

CREATE POLICY "leasing updates tenants" ON tenants
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'leasing_agent'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'leasing_agent'])
    );

-- ============================================================================
-- LEASES
-- ============================================================================
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff view leases" ON leases
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_has_role(ARRAY['owner', 'property_manager', 'leasing_agent', 'accounting'])
    );

CREATE POLICY "leasing manages leases" ON leases
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'leasing_agent'])
    );

CREATE POLICY "leasing updates leases" ON leases
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'leasing_agent'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'leasing_agent'])
    );

-- ============================================================================
-- LEASE AUDIT LOG
-- ============================================================================
ALTER TABLE lease_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers view lease history" ON lease_audit_log
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

-- ============================================================================
-- MAINTENANCE REQUESTS
-- ============================================================================
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Staff sees all org requests
CREATE POLICY "staff view requests" ON maintenance_requests
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_has_role(ARRAY['owner', 'property_manager', 'maintenance_tech', 'leasing_agent'])
    );

-- Residents see their own requests
CREATE POLICY "residents view own requests" ON maintenance_requests
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND reported_by = auth.uid()
    );

-- Anyone in org can submit a request
CREATE POLICY "anyone submits requests" ON maintenance_requests
    FOR INSERT WITH CHECK (organization_id = auth_org_id());

-- Staff can update requests
CREATE POLICY "staff updates requests" ON maintenance_requests
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'maintenance_tech'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager', 'maintenance_tech'])
    );

-- ============================================================================
-- VENDORS
-- ============================================================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view vendors" ON vendors
    FOR SELECT USING (organization_id = auth_org_id() AND deleted_at IS NULL);

-- Vendor users see their own record
CREATE POLICY "vendor views self" ON vendors
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND user_id = auth.uid()
    );

CREATE POLICY "managers manage vendors" ON vendors
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE POLICY "managers update vendors" ON vendors
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

-- ============================================================================
-- WORK ORDERS
-- ============================================================================
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Managers see all
CREATE POLICY "managers view work orders" ON work_orders
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_has_role(ARRAY['owner', 'property_manager', 'accounting'])
    );

-- Techs see assigned only
CREATE POLICY "techs view assigned" ON work_orders
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_has_role(ARRAY['maintenance_tech'])
        AND assigned_to = auth.uid()
    );

-- Vendor users see their assigned work orders
CREATE POLICY "vendors view assigned" ON work_orders
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_has_role(ARRAY['vendor_user'])
        AND vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
    );

CREATE POLICY "managers create work orders" ON work_orders
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

-- Managers can update any work order
CREATE POLICY "managers update work orders" ON work_orders
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

-- Techs can update their assigned work orders
CREATE POLICY "techs update assigned" ON work_orders
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['maintenance_tech'])
        AND assigned_to = auth.uid()
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['maintenance_tech'])
        AND assigned_to = auth.uid()
    );

-- ============================================================================
-- WORK ORDER EVENTS
-- ============================================================================
ALTER TABLE work_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view events" ON work_order_events
    FOR SELECT USING (organization_id = auth_org_id());

CREATE POLICY "org members create events" ON work_order_events
    FOR INSERT WITH CHECK (organization_id = auth_org_id());

-- ============================================================================
-- FINANCIAL TRANSACTIONS
-- ============================================================================
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance roles view transactions" ON financial_transactions
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND deleted_at IS NULL
        AND auth_has_role(ARRAY['owner', 'property_manager', 'accounting'])
    );

CREATE POLICY "finance roles create transactions" ON financial_transactions
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'accounting'])
    );

CREATE POLICY "finance roles update transactions" ON financial_transactions
    FOR UPDATE USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'accounting'])
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'accounting'])
    );

-- ============================================================================
-- PERFORMANCE SNAPSHOTS (read-only for users)
-- ============================================================================
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view snapshots" ON performance_snapshots
    FOR SELECT USING (organization_id = auth_org_id());

-- Writes done by compute-metrics Edge Function via service_role (bypasses RLS)

-- ============================================================================
-- AI ACTION LOGS
-- ============================================================================
ALTER TABLE ai_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers view ai logs" ON ai_action_logs
    FOR SELECT USING (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

-- Writes done by Edge Functions via service_role

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
