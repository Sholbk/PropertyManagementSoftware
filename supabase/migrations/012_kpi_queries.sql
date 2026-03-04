-- ============================================================================
-- KPI VIEWS — Real-time calculations from source tables
-- ============================================================================
-- These views feed the compute-metrics Edge Function.
-- Dashboards should read from performance_snapshots, not these views directly.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VACANCY RATE by property
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_vacancy_by_property AS
SELECT
    p.organization_id,
    p.id AS property_id,
    p.name AS property_name,
    COUNT(u.id) AS total_units,
    COUNT(u.id) FILTER (WHERE u.status = 'vacant') AS vacant_units,
    COUNT(u.id) FILTER (WHERE u.status = 'occupied') AS occupied_units,
    CASE WHEN COUNT(u.id) > 0
        THEN ROUND(COUNT(u.id) FILTER (WHERE u.status = 'vacant')::NUMERIC / COUNT(u.id), 4)
        ELSE 0
    END AS vacancy_rate,
    CASE WHEN COUNT(u.id) > 0
        THEN ROUND(COUNT(u.id) FILTER (WHERE u.status = 'occupied')::NUMERIC / COUNT(u.id), 4)
        ELSE 0
    END AS occupancy_rate
FROM properties p
LEFT JOIN units u ON u.property_id = p.id AND u.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.organization_id, p.id, p.name;

-- ----------------------------------------------------------------------------
-- RENT ROLL — active leases with rent vs market comparison
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rent_roll AS
SELECT
    l.organization_id,
    l.property_id,
    p.name AS property_name,
    u.id AS unit_id,
    u.unit_number,
    t.id AS tenant_id,
    t.first_name || ' ' || t.last_name AS tenant_name,
    l.id AS lease_id,
    l.monthly_rent,
    u.market_rent,
    CASE WHEN u.market_rent > 0
        THEN ROUND((l.monthly_rent - u.market_rent) / u.market_rent, 4)
        ELSE 0
    END AS rent_vs_market_pct,
    l.start_date,
    l.end_date,
    l.status,
    CASE WHEN l.end_date IS NOT NULL
        THEN l.end_date - CURRENT_DATE
        ELSE NULL
    END AS days_until_expiry
FROM leases l
JOIN units u ON u.id = l.unit_id
JOIN properties p ON p.id = l.property_id
JOIN tenants t ON t.id = l.tenant_id
WHERE l.deleted_at IS NULL
  AND l.status IN ('active', 'month_to_month')
  AND u.deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- RENT GROWTH on renewals
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rent_growth AS
SELECT
    curr.organization_id,
    curr.property_id,
    curr.unit_id,
    prev.monthly_rent AS previous_rent,
    curr.monthly_rent AS current_rent,
    curr.monthly_rent - prev.monthly_rent AS rent_change,
    CASE WHEN prev.monthly_rent > 0
        THEN ROUND((curr.monthly_rent - prev.monthly_rent) / prev.monthly_rent, 4)
        ELSE 0
    END AS rent_growth_pct,
    curr.start_date AS renewal_date
FROM leases curr
JOIN leases prev ON prev.id = curr.previous_lease_id
WHERE curr.deleted_at IS NULL AND prev.deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- NOI by property by month
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_noi_monthly AS
WITH monthly AS (
    SELECT
        organization_id,
        property_id,
        DATE_TRUNC('month', transaction_date)::DATE AS month,
        SUM(amount) FILTER (WHERE amount > 0) AS income,
        SUM(ABS(amount)) FILTER (WHERE amount < 0 AND type != 'capex') AS opex,
        SUM(ABS(amount)) FILTER (WHERE amount < 0 AND type = 'maintenance_expense') AS maintenance,
        SUM(ABS(amount)) FILTER (WHERE amount < 0 AND type = 'capex') AS capex
    FROM financial_transactions
    WHERE deleted_at IS NULL AND status = 'completed'
    GROUP BY organization_id, property_id, DATE_TRUNC('month', transaction_date)
)
SELECT
    organization_id,
    property_id,
    month,
    COALESCE(income, 0) AS income,
    COALESCE(opex, 0) AS opex,
    COALESCE(maintenance, 0) AS maintenance,
    COALESCE(capex, 0) AS capex,
    COALESCE(income, 0) - COALESCE(opex, 0) AS noi,
    CASE WHEN COALESCE(income, 0) > 0
        THEN ROUND(COALESCE(opex, 0) / income, 4)
        ELSE 0
    END AS expense_ratio
FROM monthly;

-- ----------------------------------------------------------------------------
-- RENT COLLECTION RATE by month
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rent_collection AS
SELECT
    organization_id,
    property_id,
    DATE_TRUNC('month', due_date)::DATE AS month,
    COUNT(*) AS total_charges,
    COUNT(*) FILTER (WHERE status = 'completed') AS paid_charges,
    SUM(amount) AS total_billed,
    SUM(amount) FILTER (WHERE status = 'completed') AS total_collected,
    CASE WHEN SUM(amount) > 0
        THEN ROUND(SUM(amount) FILTER (WHERE status = 'completed') / SUM(amount), 4)
        ELSE 0
    END AS collection_rate,
    COUNT(*) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE) AS delinquent_count,
    COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE), 0) AS delinquent_amount
FROM financial_transactions
WHERE deleted_at IS NULL AND type = 'rent_payment' AND due_date IS NOT NULL
GROUP BY organization_id, property_id, DATE_TRUNC('month', due_date);

-- ----------------------------------------------------------------------------
-- MAINTENANCE PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_maintenance_performance AS
SELECT
    wo.organization_id,
    wo.property_id,
    DATE_TRUNC('month', wo.completed_at)::DATE AS month,
    COUNT(wo.id) AS completed_count,
    SUM(wo.total_cost) AS total_cost,
    -- Avg hours from creation to completion
    ROUND(AVG(EXTRACT(EPOCH FROM (wo.completed_at - wo.created_at)) / 3600), 2) AS avg_completion_hours,
    -- Avg hours from request reported to acknowledged
    ROUND(AVG(EXTRACT(EPOCH FROM (mr.acknowledged_at - mr.reported_at)) / 3600), 2) AS avg_response_hours,
    -- Satisfaction from resolved requests
    ROUND(AVG(mr.resolution_rating), 2) AS avg_satisfaction,
    COUNT(wo.id) FILTER (WHERE wo.priority = 'emergency') AS emergency_count
FROM work_orders wo
LEFT JOIN maintenance_requests mr ON mr.id = wo.maintenance_request_id
WHERE wo.deleted_at IS NULL
  AND wo.status IN ('completed', 'verified', 'closed')
  AND wo.completed_at IS NOT NULL
GROUP BY wo.organization_id, wo.property_id, DATE_TRUNC('month', wo.completed_at);

-- ----------------------------------------------------------------------------
-- TENANT RETENTION by quarter
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tenant_retention AS
SELECT
    organization_id,
    property_id,
    DATE_TRUNC('quarter', end_date)::DATE AS quarter,
    COUNT(*) AS leases_ended,
    COUNT(*) FILTER (WHERE status = 'renewed') AS renewed,
    COUNT(*) FILTER (WHERE status IN ('expired', 'terminated')) AS lost,
    CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'renewed')::NUMERIC / COUNT(*), 4)
        ELSE 0
    END AS retention_rate
FROM leases
WHERE deleted_at IS NULL AND end_date IS NOT NULL AND end_date <= CURRENT_DATE
GROUP BY organization_id, property_id, DATE_TRUNC('quarter', end_date);

-- ----------------------------------------------------------------------------
-- PORTFOLIO SUMMARY (cross-property aggregate)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_portfolio_summary AS
SELECT
    v.organization_id,
    SUM(v.total_units) AS total_units,
    SUM(v.occupied_units) AS occupied_units,
    SUM(v.vacant_units) AS vacant_units,
    ROUND(AVG(v.vacancy_rate), 4) AS avg_vacancy_rate,
    (
        SELECT COALESCE(SUM(l.monthly_rent), 0)
        FROM leases l
        WHERE l.organization_id = v.organization_id
          AND l.deleted_at IS NULL
          AND l.status IN ('active', 'month_to_month')
    ) AS monthly_rental_income,
    (
        SELECT COUNT(*)
        FROM work_orders wo
        WHERE wo.organization_id = v.organization_id
          AND wo.deleted_at IS NULL
          AND wo.status NOT IN ('completed', 'verified', 'closed', 'cancelled')
    ) AS open_work_orders,
    (
        SELECT COUNT(*)
        FROM maintenance_requests mr
        WHERE mr.organization_id = v.organization_id
          AND mr.deleted_at IS NULL
          AND mr.status NOT IN ('resolved', 'closed', 'cancelled')
    ) AS open_requests
FROM v_vacancy_by_property v
GROUP BY v.organization_id;


-- ============================================================================
-- SAMPLE KPI QUERIES (for reference — use in app or Edge Functions)
-- ============================================================================

/*
-- 1. Dashboard: Current vacancy rate for a property
SELECT vacancy_rate, occupancy_rate, total_units, vacant_units
FROM v_vacancy_by_property
WHERE organization_id = :org_id AND property_id = :property_id;

-- 2. Dashboard: NOI trend for last 12 months
SELECT month, income, opex, noi, expense_ratio
FROM v_noi_monthly
WHERE organization_id = :org_id AND property_id = :property_id
  AND month >= (CURRENT_DATE - INTERVAL '12 months')
ORDER BY month;

-- 3. Dashboard: Rent collection this month
SELECT collection_rate, delinquent_count, delinquent_amount
FROM v_rent_collection
WHERE organization_id = :org_id
  AND month = DATE_TRUNC('month', CURRENT_DATE)::DATE;

-- 4. Dashboard: Maintenance performance this month
SELECT avg_completion_hours, avg_response_hours, avg_satisfaction, total_cost
FROM v_maintenance_performance
WHERE organization_id = :org_id
  AND month = DATE_TRUNC('month', CURRENT_DATE)::DATE;

-- 5. Leasing: Leases expiring in next 90 days
SELECT unit_number, tenant_name, monthly_rent, days_until_expiry
FROM v_rent_roll
WHERE organization_id = :org_id
  AND days_until_expiry BETWEEN 0 AND 90
ORDER BY days_until_expiry;

-- 6. Leasing: Average rent growth on renewals this year
SELECT ROUND(AVG(rent_growth_pct), 4) AS avg_growth, COUNT(*) AS renewals
FROM v_rent_growth
WHERE organization_id = :org_id
  AND renewal_date >= DATE_TRUNC('year', CURRENT_DATE);

-- 7. Financial: Maintenance cost per unit per property this year
SELECT
    p.name,
    COUNT(DISTINCT u.id) AS units,
    SUM(wo.total_cost) AS total_maint_cost,
    ROUND(SUM(wo.total_cost) / NULLIF(COUNT(DISTINCT u.id), 0), 2) AS cost_per_unit
FROM work_orders wo
JOIN properties p ON p.id = wo.property_id
JOIN units u ON u.property_id = p.id AND u.deleted_at IS NULL
WHERE wo.organization_id = :org_id
  AND wo.deleted_at IS NULL
  AND wo.status IN ('completed', 'verified', 'closed')
  AND wo.completed_at >= DATE_TRUNC('year', CURRENT_DATE)
GROUP BY p.id, p.name;

-- 8. Snapshot: Pull pre-computed KPIs for dashboard (fastest query)
SELECT *
FROM performance_snapshots
WHERE organization_id = :org_id
  AND property_id = :property_id  -- or IS NULL for portfolio
  AND period_type = 'monthly'
  AND period_date = DATE_TRUNC('month', CURRENT_DATE)::DATE;

-- 9. Trend: KPI over last 6 months from snapshots
SELECT period_date, noi, vacancy_rate, rent_collection_rate, avg_completion_hours
FROM performance_snapshots
WHERE organization_id = :org_id
  AND property_id = :property_id
  AND period_type = 'monthly'
  AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
ORDER BY period_date;

-- 10. AI effectiveness: acceptance rate by domain
SELECT
    domain,
    COUNT(*) AS total_suggestions,
    COUNT(*) FILTER (WHERE was_accepted = true) AS accepted,
    ROUND(
        COUNT(*) FILTER (WHERE was_accepted = true)::NUMERIC / NULLIF(COUNT(*), 0), 4
    ) AS acceptance_rate
FROM ai_action_logs
WHERE organization_id = :org_id
  AND was_accepted IS NOT NULL
GROUP BY domain;
*/
