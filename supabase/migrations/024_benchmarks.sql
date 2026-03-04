-- ============================================================================
-- 024_benchmarks.sql — Anonymous aggregated benchmark data
-- NO organization_id column — structural privacy safeguard
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_data (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_type                 TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
    period_date                 DATE NOT NULL,

    -- Segmentation dimensions
    property_type               TEXT NOT NULL,
    state                       TEXT NOT NULL,
    unit_count_bucket           TEXT NOT NULL,  -- '1-10', '11-50', '51-200', '200+'

    -- Minimum sample size (must be >= 5 to publish)
    sample_size                 INT NOT NULL,

    -- Aggregated KPIs (averages/medians only — no min/max)
    avg_vacancy_rate            NUMERIC(6, 4),
    median_vacancy_rate         NUMERIC(6, 4),
    avg_occupancy_rate          NUMERIC(6, 4),
    avg_rent_per_unit           NUMERIC(10, 2),
    median_rent_per_unit        NUMERIC(10, 2),
    avg_expense_ratio           NUMERIC(6, 4),
    avg_noi_per_unit            NUMERIC(10, 2),
    avg_rent_collection_rate    NUMERIC(6, 4),
    avg_maintenance_cost_per_unit NUMERIC(10, 2),
    avg_completion_hours        NUMERIC(10, 2),
    avg_tenant_retention        NUMERIC(6, 4),
    avg_days_to_lease           NUMERIC(8, 2),
    avg_rent_growth_pct         NUMERIC(6, 4),
    p25_rent_per_unit           NUMERIC(10, 2),
    p75_rent_per_unit           NUMERIC(10, 2),
    p25_vacancy_rate            NUMERIC(6, 4),
    p75_vacancy_rate            NUMERIC(6, 4),

    computed_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bench_unique
  ON benchmark_data(period_type, period_date, property_type, state, unit_count_bucket);
CREATE INDEX IF NOT EXISTS idx_bench_lookup
  ON benchmark_data(property_type, state, period_date DESC);

ALTER TABLE benchmark_data ENABLE ROW LEVEL SECURITY;

-- Public read for authenticated users; writes via service_role only
CREATE POLICY "authenticated users view benchmarks" ON benchmark_data
    FOR SELECT USING (true);
