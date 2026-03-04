-- ============================================================================
-- KPI CALCULATION VIEWS
-- These views compute real-time KPIs from source tables.
-- Use metric_snapshots for dashboard queries; these views feed the snapshot job.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VACANCY RATE by property (real-time)
-- vacancy_rate = vacant_units / total_units
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_vacancy_by_property AS
SELECT
    p.org_id,
    p.id AS property_id,
    p.name AS property_name,
    COUNT(u.id) AS total_units,
    COUNT(u.id) FILTER (WHERE u.status = 'vacant') AS vacant_units,
    COUNT(u.id) FILTER (WHERE u.status = 'occupied') AS occupied_units,
    CASE
        WHEN COUNT(u.id) > 0
        THEN ROUND(
            COUNT(u.id) FILTER (WHERE u.status = 'vacant')::NUMERIC / COUNT(u.id), 4
        )
        ELSE 0
    END AS vacancy_rate,
    CASE
        WHEN COUNT(u.id) > 0
        THEN ROUND(
            COUNT(u.id) FILTER (WHERE u.status = 'occupied')::NUMERIC / COUNT(u.id), 4
        )
        ELSE 0
    END AS occupancy_rate
FROM properties p
LEFT JOIN units u ON u.property_id = p.id AND u.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.org_id, p.id, p.name;

-- ----------------------------------------------------------------------------
-- RENT ROLL — current active leases with expected vs actual revenue
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rent_roll AS
SELECT
    l.org_id,
    p.id AS property_id,
    p.name AS property_name,
    u.id AS unit_id,
    u.unit_number,
    t.id AS tenant_id,
    t.first_name || ' ' || t.last_name AS tenant_name,
    l.id AS lease_id,
    l.monthly_rent,
    u.market_rent,
    CASE
        WHEN u.market_rent > 0
        THEN ROUND((l.monthly_rent - u.market_rent) / u.market_rent, 4)
        ELSE 0
    END AS rent_vs_market_pct,
    l.start_date,
    l.end_date,
    l.status AS lease_status,
    -- Days until lease expires
    CASE
        WHEN l.end_date IS NOT NULL
        THEN l.end_date - CURRENT_DATE
        ELSE NULL
    END AS days_until_expiry
FROM leases l
JOIN units u ON u.id = l.unit_id
JOIN properties p ON p.id = u.property_id
JOIN tenants t ON t.id = l.tenant_id
WHERE l.deleted_at IS NULL
  AND l.status IN ('active', 'month_to_month')
  AND u.deleted_at IS NULL
  AND p.deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- RENT GROWTH — compares renewed lease rent to prior lease rent
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rent_growth AS
SELECT
    curr.org_id,
    u.property_id,
    curr.unit_id,
    u.unit_number,
    prev.id AS previous_lease_id,
    prev.monthly_rent AS previous_rent,
    curr.id AS current_lease_id,
    curr.monthly_rent AS current_rent,
    curr.monthly_rent - prev.monthly_rent AS rent_change,
    CASE
        WHEN prev.monthly_rent > 0
        THEN ROUND((curr.monthly_rent - prev.monthly_rent) / prev.monthly_rent, 4)
        ELSE 0
    END AS rent_growth_pct,
    curr.start_date AS renewal_date
FROM leases curr
JOIN leases prev ON prev.id = curr.previous_lease_id
JOIN units u ON u.id = curr.unit_id
WHERE curr.deleted_at IS NULL
  AND prev.deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- MAINTENANCE COST PER UNIT by property
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_maintenance_cost_per_unit AS
SELECT
    wo.org_id,
    wo.property_id,
    p.name AS property_name,
    p.total_units,
    DATE_TRUNC('month', wo.completed_at) AS month,
    COUNT(wo.id) AS completed_work_orders,
    SUM(wo.total_cost) AS total_maintenance_cost,
    CASE
        WHEN p.total_units > 0
        THEN ROUND(SUM(wo.total_cost) / p.total_units, 2)
        ELSE 0
    END AS cost_per_unit,
    ROUND(AVG(
        EXTRACT(EPOCH FROM (wo.completed_at - wo.reported_at)) / 3600
    ), 2) AS avg_completion_hours,
    ROUND(AVG(wo.tenant_rating), 2) AS avg_satisfaction
FROM work_orders wo
JOIN properties p ON p.id = wo.property_id
WHERE wo.deleted_at IS NULL
  AND wo.status IN ('completed', 'closed')
  AND wo.completed_at IS NOT NULL
GROUP BY wo.org_id, wo.property_id, p.name, p.total_units,
         DATE_TRUNC('month', wo.completed_at);

-- ----------------------------------------------------------------------------
-- NET OPERATING INCOME by property by month
-- NOI = Income - Operating Expenses (excludes debt service and capex)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_noi_by_property AS
WITH income AS (
    SELECT
        org_id,
        property_id,
        DATE_TRUNC('month', transaction_date) AS month,
        SUM(amount) FILTER (WHERE amount > 0) AS total_income
    FROM transactions
    WHERE deleted_at IS NULL
      AND status = 'completed'
    GROUP BY org_id, property_id, DATE_TRUNC('month', transaction_date)
),
expenses AS (
    SELECT
        org_id,
        property_id,
        DATE_TRUNC('month', transaction_date) AS month,
        SUM(ABS(amount)) FILTER (
            WHERE amount < 0
            AND type NOT IN ('capex')  -- NOI excludes capex
        ) AS operating_expenses,
        SUM(ABS(amount)) FILTER (
            WHERE amount < 0 AND type = 'maintenance_expense'
        ) AS maintenance_expenses,
        SUM(ABS(amount)) FILTER (
            WHERE amount < 0 AND type = 'capex'
        ) AS capex
    FROM transactions
    WHERE deleted_at IS NULL
      AND status = 'completed'
    GROUP BY org_id, property_id, DATE_TRUNC('month', transaction_date)
)
SELECT
    COALESCE(i.org_id, e.org_id) AS org_id,
    COALESCE(i.property_id, e.property_id) AS property_id,
    COALESCE(i.month, e.month) AS month,
    COALESCE(i.total_income, 0) AS total_income,
    COALESCE(e.operating_expenses, 0) AS operating_expenses,
    COALESCE(e.maintenance_expenses, 0) AS maintenance_expenses,
    COALESCE(e.capex, 0) AS capex,
    COALESCE(i.total_income, 0) - COALESCE(e.operating_expenses, 0) AS noi,
    CASE
        WHEN COALESCE(i.total_income, 0) > 0
        THEN ROUND(COALESCE(e.operating_expenses, 0) / i.total_income, 4)
        ELSE 0
    END AS expense_ratio
FROM income i
FULL OUTER JOIN expenses e
    ON e.org_id = i.org_id
    AND e.property_id = i.property_id
    AND e.month = i.month;

-- ----------------------------------------------------------------------------
-- RENT COLLECTION RATE by month
-- collection_rate = paid_rent / billed_rent
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rent_collection AS
SELECT
    org_id,
    property_id,
    DATE_TRUNC('month', due_date) AS month,
    COUNT(id) AS total_charges,
    COUNT(id) FILTER (WHERE status = 'completed') AS paid_charges,
    SUM(amount) AS total_billed,
    SUM(amount) FILTER (WHERE status = 'completed') AS total_collected,
    CASE
        WHEN SUM(amount) > 0
        THEN ROUND(
            SUM(amount) FILTER (WHERE status = 'completed') / SUM(amount), 4
        )
        ELSE 0
    END AS collection_rate,
    -- Delinquency: unpaid past due
    COUNT(id) FILTER (
        WHERE status = 'pending' AND due_date < CURRENT_DATE
    ) AS delinquent_count,
    COALESCE(SUM(amount) FILTER (
        WHERE status = 'pending' AND due_date < CURRENT_DATE
    ), 0) AS delinquent_amount
FROM transactions
WHERE deleted_at IS NULL
  AND type = 'rent_payment'
  AND due_date IS NOT NULL
GROUP BY org_id, property_id, DATE_TRUNC('month', due_date);

-- ----------------------------------------------------------------------------
-- TENANT RETENTION RATE
-- retention = renewed_leases / (renewed + not_renewed) over a period
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tenant_retention AS
SELECT
    org_id,
    DATE_TRUNC('quarter', end_date) AS quarter,
    COUNT(id) AS leases_expired,
    COUNT(id) FILTER (WHERE status = 'renewed') AS leases_renewed,
    COUNT(id) FILTER (WHERE status IN ('expired', 'terminated')) AS leases_lost,
    CASE
        WHEN COUNT(id) > 0
        THEN ROUND(
            COUNT(id) FILTER (WHERE status = 'renewed')::NUMERIC / COUNT(id), 4
        )
        ELSE 0
    END AS retention_rate
FROM leases
WHERE deleted_at IS NULL
  AND end_date IS NOT NULL
  AND end_date <= CURRENT_DATE
GROUP BY org_id, DATE_TRUNC('quarter', end_date);

-- ----------------------------------------------------------------------------
-- PORTFOLIO SUMMARY — aggregated across all properties for an org
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_portfolio_summary AS
SELECT
    v.org_id,
    SUM(v.total_units) AS total_units,
    SUM(v.occupied_units) AS occupied_units,
    SUM(v.vacant_units) AS vacant_units,
    ROUND(AVG(v.vacancy_rate), 4) AS avg_vacancy_rate,
    (SELECT COALESCE(SUM(l.monthly_rent), 0)
     FROM leases l
     WHERE l.org_id = v.org_id
       AND l.deleted_at IS NULL
       AND l.status IN ('active', 'month_to_month')
    ) AS monthly_rental_income,
    (SELECT COUNT(*)
     FROM work_orders wo
     WHERE wo.org_id = v.org_id
       AND wo.deleted_at IS NULL
       AND wo.status NOT IN ('completed', 'closed', 'cancelled')
    ) AS open_work_orders
FROM v_vacancy_by_property v
GROUP BY v.org_id;
