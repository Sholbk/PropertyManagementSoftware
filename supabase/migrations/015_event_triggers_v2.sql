-- ============================================================================
-- EVENT TRIGGERS v2 — Vacancy, Work Order Complete, Inspection Failed,
--                     Late Payment Cron, Lease Expiry Cron
-- ============================================================================
-- Requires pg_net (already enabled in 013_ai_triggers.sql)
-- ============================================================================

-- ============================================================================
-- 1. VACANCY CREATED — notify when unit becomes vacant
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_notify_vacancy()
RETURNS TRIGGER AS $$
DECLARE
    edge_url TEXT;
    service_key TEXT;
BEGIN
    -- Only fire when status changes TO 'vacant'
    IF NEW.status = 'vacant' AND OLD.status != 'vacant' THEN
        edge_url := 'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/notify-vacancy';
        service_key := current_setting('supabase.service_role_key', true);

        IF service_key IS NOT NULL AND service_key != '' THEN
            PERFORM net.http_post(
                url := edge_url,
                body := jsonb_build_object(
                    'unit_id', NEW.id,
                    'organization_id', NEW.organization_id,
                    'property_id', NEW.property_id
                ),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_key
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_unit_vacancy_created
    AFTER UPDATE ON units
    FOR EACH ROW
    EXECUTE FUNCTION trigger_notify_vacancy();

-- ============================================================================
-- 2. WORK ORDER COMPLETED — notify PM and tenant
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_notify_work_order_complete()
RETURNS TRIGGER AS $$
DECLARE
    edge_url TEXT;
    service_key TEXT;
BEGIN
    -- Only fire when status changes TO 'completed' or 'verified'
    IF NEW.status IN ('completed', 'verified') AND OLD.status NOT IN ('completed', 'verified') THEN
        edge_url := 'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/notify-work-order-complete';
        service_key := current_setting('supabase.service_role_key', true);

        IF service_key IS NOT NULL AND service_key != '' THEN
            PERFORM net.http_post(
                url := edge_url,
                body := jsonb_build_object(
                    'work_order_id', NEW.id,
                    'organization_id', NEW.organization_id
                ),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_key
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_work_order_completed_notify
    AFTER UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_notify_work_order_complete();

-- ============================================================================
-- 3. INSPECTION FAILED — notify PM, inspector, maintenance team
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_notify_inspection_failed()
RETURNS TRIGGER AS $$
DECLARE
    edge_url TEXT;
    service_key TEXT;
BEGIN
    -- Fire when status changes TO 'failed'
    IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
        edge_url := 'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/notify-inspection-failed';
        service_key := current_setting('supabase.service_role_key', true);

        IF service_key IS NOT NULL AND service_key != '' THEN
            PERFORM net.http_post(
                url := edge_url,
                body := jsonb_build_object(
                    'inspection_id', NEW.id,
                    'organization_id', NEW.organization_id
                ),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_key
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_inspection_failed
    AFTER UPDATE ON inspections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_notify_inspection_failed();

-- ============================================================================
-- 4. CRON: Daily Late Payment Check (9 AM UTC)
-- ============================================================================
-- Requires pg_cron enabled in Supabase Dashboard > Database > Extensions
-- Uncomment when ready to activate:

-- SELECT cron.schedule(
--   'daily-late-payment-check',
--   '0 9 * * *',
--   $$
--   DO $do$
--   DECLARE
--     txn RECORD;
--     svc_key TEXT;
--   BEGIN
--     svc_key := current_setting('supabase.service_role_key', true);
--     IF svc_key IS NULL OR svc_key = '' THEN RETURN; END IF;
--
--     FOR txn IN
--       SELECT id, organization_id
--       FROM financial_transactions
--       WHERE type = 'rent_payment'
--         AND status = 'pending'
--         AND due_date < CURRENT_DATE
--         AND deleted_at IS NULL
--     LOOP
--       PERFORM net.http_post(
--         'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/notify-late-payment',
--         jsonb_build_object('transaction_id', txn.id, 'organization_id', txn.organization_id),
--         jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || svc_key
--         )
--       );
--     END LOOP;
--   END;
--   $do$;
--   $$
-- );

-- ============================================================================
-- 5. CRON: Daily Lease Expiry Check (8 AM UTC)
-- ============================================================================
-- Checks leases expiring within 90 days and sends notifications + AI analysis.
-- Uncomment when ready to activate:

-- SELECT cron.schedule(
--   'daily-lease-expiry-check',
--   '0 8 * * *',
--   $$
--   DO $do$
--   DECLARE
--     lease RECORD;
--     svc_key TEXT;
--   BEGIN
--     svc_key := current_setting('supabase.service_role_key', true);
--     IF svc_key IS NULL OR svc_key = '' THEN RETURN; END IF;
--
--     FOR lease IN
--       SELECT id, organization_id
--       FROM leases
--       WHERE status IN ('active', 'month_to_month')
--         AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
--         AND deleted_at IS NULL
--     LOOP
--       -- Trigger notification
--       PERFORM net.http_post(
--         'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/notify-lease-expiring',
--         jsonb_build_object('lease_id', lease.id, 'organization_id', lease.organization_id),
--         jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || svc_key
--         )
--       );
--
--       -- Trigger AI lease advisor
--       PERFORM net.http_post(
--         'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/ai-lease-advisor',
--         jsonb_build_object('lease_id', lease.id),
--         jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || svc_key
--         )
--       );
--     END LOOP;
--   END;
--   $do$;
--   $$
-- );
