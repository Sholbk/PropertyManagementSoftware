# PMPP Database Architecture

## Entity Relationship Diagram (text)

```
organizations (1)
 ├── users (N)
 │    └── user_property_assignments (N) ──► properties
 ├── properties (N)
 │    ├── units (N)
 │    │    └── leases (N) ──► tenants
 │    │         └── lease_history (N)
 │    ├── work_orders (N)
 │    │    ├── work_order_attachments (N)
 │    │    ├── work_order_status_log (N)
 │    │    └──► vendors (optional)
 │    └── transactions (N)
 │         ├──► leases (optional)
 │         ├──► tenants (optional)
 │         ├──► vendors (optional)
 │         └──► work_orders (optional)
 ├── vendors (N)
 ├── tenants (N)
 ├── ai_activity_logs (N)
 ├── metric_snapshots (N)
 ├── notifications (N) ──► users
 └── audit_log (N)
```

## Key Relationships

| Parent            | Child                      | Cardinality | FK Column      |
|-------------------|----------------------------|-------------|----------------|
| organizations     | users                      | 1:N         | org_id         |
| organizations     | properties                 | 1:N         | org_id         |
| properties        | units                      | 1:N         | property_id    |
| units             | leases                     | 1:N         | unit_id        |
| tenants           | leases                     | 1:N         | tenant_id      |
| leases            | lease_history              | 1:N         | lease_id       |
| leases            | leases (self)              | 1:1         | previous_lease_id |
| properties        | work_orders                | 1:N         | property_id    |
| vendors           | work_orders                | 1:N         | vendor_id      |
| users             | work_orders (assigned)     | 1:N         | assigned_to    |
| properties        | transactions               | 1:N         | property_id    |
| users             | user_property_assignments  | 1:N         | user_id        |
| properties        | user_property_assignments  | 1:N         | property_id    |
| work_orders       | work_order_attachments     | 1:N         | work_order_id  |
| work_orders       | work_order_status_log      | 1:N         | work_order_id  |

## Indexing Strategy

### Principles
1. **Every FK gets an index** — all foreign keys are indexed for JOIN performance
2. **Partial indexes with `WHERE deleted_at IS NULL`** — soft-deleted rows excluded from all hot-path queries
3. **Composite indexes lead with `org_id`** — RLS filter is always first, aligning with the B-tree
4. **KPI-specific indexes** — dedicated indexes for the exact query patterns KPI views use
5. **GIN index on arrays** — vendor specialties use GIN for `@>` containment queries

### Index Categories

| Category          | Example Index                                    | Purpose                          |
|-------------------|--------------------------------------------------|----------------------------------|
| Tenant isolation  | `(org_id)` on every table                        | RLS filter, always first in scan |
| Status filtering  | `(org_id, status)` on leases, work_orders        | Dashboard filters                |
| Time-series       | `(org_id, property_id, transaction_date DESC)`   | Financial reports, NOI calc      |
| KPI computation   | `(org_id, property_id, reported_at, completed_at)` | Avg completion time            |
| Expiration        | `(org_id, end_date)` on leases WHERE active      | Renewal pipeline                 |
| Outstanding items | `(org_id, due_date)` WHERE status=pending        | Delinquency tracking             |
| Audit trail       | `(org_id, entity_type, entity_id, created_at)`   | Entity history lookup            |
| Text search       | GIN trigram on tenant names (add if needed)       | Fuzzy search                     |

## Performance Considerations

### 1. Query Patterns & Optimization
- **Dashboard queries hit `metric_snapshots`**, not source tables. A background job
  (cron every hour or nightly) computes KPIs from the views in `002_kpi_views.sql`
  and writes to `metric_snapshots`. Dashboards read pre-computed data in <10ms.
- **Real-time counts** (open work orders, vacant units) use partial indexes that
  exclude completed/deleted rows — these scans touch minimal rows.
- **Rent roll** and **lease expiry** queries use composite indexes that match the
  exact WHERE + ORDER BY pattern.

### 2. Soft Delete Performance
- All partial indexes include `WHERE deleted_at IS NULL`, so soft-deleted rows
  don't bloat index scans.
- For tables with high delete rates, schedule `VACUUM` more aggressively.
- Consider partitioning `transactions` and `audit_log` by month if they exceed
  ~50M rows.

### 3. Multi-Tenant Isolation
- RLS policies use `current_setting('app.current_org_id')`. This is set once per
  request via `SET LOCAL`, scoped to the transaction.
- Since `org_id` is the leading column in every composite index, the planner
  efficiently range-scans only that tenant's data.
- At scale (>1000 tenants), consider connection pooling (PgBouncer) in
  transaction mode to maintain `SET LOCAL` semantics.

### 4. Write-Heavy Tables
- `audit_log`: Append-only, no updates. Partition by `created_at` monthly.
- `ai_activity_logs`: Same — partition by month, set retention policy (e.g., 12 months).
- `work_order_status_log`: Grows with every status change. Partition by month if needed.
- `transactions`: Partition by `transaction_date` year/month for large portfolios.

### 5. Partitioning Strategy (when needed)
```sql
-- Example: partition audit_log by month
CREATE TABLE audit_log (
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_01 PARTITION OF audit_log
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- Auto-create future partitions via pg_partman
```

### 6. Connection & Pooling
- Use PgBouncer in **transaction mode** (required for `SET LOCAL` to work)
- Target: 20-50 connections per backend instance, pool up to 200 at PgBouncer
- For Supabase: built-in pooling via Supavisor handles this

### 7. Estimated Table Sizes (per 1000-unit portfolio, 1 year)
| Table              | Est. Rows | Growth Rate    |
|--------------------|-----------|----------------|
| units              | 1,000     | Slow           |
| leases             | 1,200     | ~200/year      |
| lease_history      | 5,000     | ~5 changes/lease |
| work_orders        | 6,000     | ~6/unit/year   |
| transactions       | 24,000    | ~2/unit/month  |
| audit_log          | 100,000+  | Every mutation |
| metric_snapshots   | 12,000    | 1000 units × 12 months |
| ai_activity_logs   | 20,000    | Varies by usage |
