-- ============================================================================
-- DATABASE TRIGGERS → EDGE FUNCTIONS (event-driven AI)
-- ============================================================================
-- These use Supabase Database Webhooks (configured in Dashboard) or
-- pg_net to call Edge Functions when specific events occur.
-- ============================================================================

-- Enable pg_net for HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- 1. Auto-triage new maintenance requests
-- ============================================================================
-- When a maintenance request is inserted, call ai-triage Edge Function.

CREATE OR REPLACE FUNCTION trigger_ai_triage()
RETURNS TRIGGER AS $$
DECLARE
    edge_url TEXT;
    service_key TEXT;
BEGIN
    edge_url := 'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/ai-triage';
    service_key := current_setting('supabase.service_role_key', true);

    -- Only trigger if service key is available (won't work in local dev without it)
    IF service_key IS NOT NULL AND service_key != '' THEN
        PERFORM net.http_post(
            url := edge_url,
            body := jsonb_build_object(
                'maintenance_request_id', NEW.id,
                'user_id', NEW.reported_by
            ),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_key
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_maintenance_request_created
    AFTER INSERT ON maintenance_requests
    FOR EACH ROW
    EXECUTE FUNCTION trigger_ai_triage();

-- ============================================================================
-- 2. Auto-update maintenance request status when work order is created
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_request_on_work_order()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.maintenance_request_id IS NOT NULL THEN
        UPDATE maintenance_requests
        SET status = 'work_order_created', updated_at = now()
        WHERE id = NEW.maintenance_request_id
          AND status IN ('new', 'acknowledged');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_work_order_created_sync_request
    AFTER INSERT ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION sync_request_on_work_order();

-- ============================================================================
-- 3. Auto-resolve maintenance request when work order is completed
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_request_on_work_order_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'verified') AND OLD.status != NEW.status THEN
        IF NEW.maintenance_request_id IS NOT NULL THEN
            UPDATE maintenance_requests
            SET status = 'resolved', resolved_at = now(), updated_at = now()
            WHERE id = NEW.maintenance_request_id
              AND status NOT IN ('resolved', 'closed');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_work_order_completed_sync_request
    AFTER UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION sync_request_on_work_order_complete();

-- ============================================================================
-- 4. Log work order status changes automatically
-- ============================================================================
CREATE OR REPLACE FUNCTION log_work_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO work_order_events (
            organization_id, work_order_id, event_type,
            old_value, new_value, created_by
        )
        VALUES (
            NEW.organization_id, NEW.id, 'status_change',
            OLD.status, NEW.status,
            COALESCE(auth.uid(), NEW.assigned_to, NEW.created_by)
        );
    END IF;

    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO work_order_events (
            organization_id, work_order_id, event_type,
            old_value, new_value, created_by
        )
        VALUES (
            NEW.organization_id, NEW.id, 'assignment',
            OLD.assigned_to::TEXT, NEW.assigned_to::TEXT,
            COALESCE(auth.uid(), NEW.created_by)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_work_order_status_change
    AFTER UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_work_order_status_change();

-- ============================================================================
-- 5. Auto-update unit status when lease status changes
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_unit_status_on_lease_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Lease activated → unit occupied
    IF NEW.status IN ('active', 'month_to_month') AND OLD.status NOT IN ('active', 'month_to_month') THEN
        UPDATE units SET status = 'occupied', updated_at = now()
        WHERE id = NEW.unit_id AND status = 'vacant';
    END IF;

    -- Lease expired/terminated → unit vacant (if no other active lease)
    IF NEW.status IN ('expired', 'terminated') AND OLD.status IN ('active', 'month_to_month') THEN
        IF NOT EXISTS (
            SELECT 1 FROM leases
            WHERE unit_id = NEW.unit_id
              AND id != NEW.id
              AND status IN ('active', 'month_to_month')
              AND deleted_at IS NULL
        ) THEN
            UPDATE units SET status = 'vacant', updated_at = now()
            WHERE id = NEW.unit_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_lease_status_change
    AFTER UPDATE ON leases
    FOR EACH ROW
    EXECUTE FUNCTION sync_unit_status_on_lease_change();

-- ============================================================================
-- 6. CRON SCHEDULES (requires pg_cron — enabled by default on Supabase)
-- ============================================================================
-- Note: pg_cron must be enabled in Supabase Dashboard > Database > Extensions

-- Compute KPI snapshots every hour
-- SELECT cron.schedule(
--   'compute-hourly-metrics',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/compute-metrics',
--     '{"trigger": "cron"}'::jsonb,
--     '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('supabase.service_role_key') || '"}'::jsonb
--   );
--   $$
-- );

-- Run anomaly detection daily at 6 AM UTC
-- SELECT cron.schedule(
--   'daily-anomaly-detection',
--   '0 6 * * *',
--   $$
--   -- This runs for each active org
--   DO $do$
--   DECLARE
--     org RECORD;
--   BEGIN
--     FOR org IN SELECT id FROM organizations WHERE subscription_status = 'active' AND deleted_at IS NULL
--     LOOP
--       PERFORM net.http_post(
--         'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/ai-anomaly-detect',
--         jsonb_build_object('organization_id', org.id),
--         '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('supabase.service_role_key') || '"}'::jsonb
--       );
--     END LOOP;
--   END;
--   $do$;
--   $$
-- );

-- Weekly revenue leakage scan (Sundays at 7 AM UTC)
-- SELECT cron.schedule(
--   'weekly-revenue-leakage',
--   '0 7 * * 0',
--   $$
--   DO $do$
--   DECLARE
--     org RECORD;
--   BEGIN
--     FOR org IN SELECT id FROM organizations WHERE subscription_status = 'active' AND deleted_at IS NULL
--     LOOP
--       PERFORM net.http_post(
--         'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/ai-revenue-leakage',
--         jsonb_build_object('organization_id', org.id),
--         '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('supabase.service_role_key') || '"}'::jsonb
--       );
--     END LOOP;
--   END;
--   $do$;
--   $$
-- );

-- Check leases expiring in 90 days (daily at 8 AM UTC)
-- SELECT cron.schedule(
--   'daily-lease-renewal-check',
--   '0 8 * * *',
--   $$
--   DO $do$
--   DECLARE
--     lease RECORD;
--   BEGIN
--     FOR lease IN
--       SELECT id, organization_id FROM leases
--       WHERE status IN ('active', 'month_to_month')
--         AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
--         AND deleted_at IS NULL
--     LOOP
--       PERFORM net.http_post(
--         'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/ai-lease-advisor',
--         jsonb_build_object('lease_id', lease.id),
--         '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('supabase.service_role_key') || '"}'::jsonb
--       );
--     END LOOP;
--   END;
--   $do$;
--   $$
-- );
