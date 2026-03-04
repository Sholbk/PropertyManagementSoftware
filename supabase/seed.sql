-- =============================================================================
-- seed.sql — Development seed data
-- Run with: supabase db reset (applies migrations + seed automatically)
-- Or manually: psql -f supabase/seed.sql
-- =============================================================================

-- Note: This seed assumes auth users are created via Supabase Auth.
-- For local development, create users via the Supabase Dashboard or CLI first,
-- then insert their IDs here.

-- Example organization
INSERT INTO organizations (id, name, slug, plan, timezone, subscription_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Property Management',
  'demo-pm',
  'professional',
  'America/Chicago',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Example properties
INSERT INTO properties (id, organization_id, name, property_type, address_line1, city, state, zip)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Sunset Apartments', 'multi_family', '123 Main St', 'Austin', 'TX', '78701'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Oak Valley Homes', 'single_family', '456 Oak Ave', 'Austin', 'TX', '78702'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Downtown Office Plaza', 'commercial', '789 Congress Ave', 'Austin', 'TX', '78703')
ON CONFLICT (id) DO NOTHING;

-- Example units for Sunset Apartments
INSERT INTO units (id, organization_id, property_id, unit_number, bedrooms, bathrooms, sqft, market_rent, status)
VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '101', 1, 1, 650, 1200, 'occupied'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '102', 1, 1, 650, 1200, 'occupied'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '201', 2, 1, 900, 1600, 'occupied'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '202', 2, 1, 900, 1600, 'vacant'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '301', 2, 2, 1100, 1900, 'occupied'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '302', 3, 2, 1300, 2200, 'maintenance')
ON CONFLICT (id) DO NOTHING;

-- Example tenants
INSERT INTO tenants (id, organization_id, first_name, last_name, email, phone)
VALUES
  ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', 'Jane', 'Smith', 'jane.smith@example.com', '512-555-0101'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Bob', 'Johnson', 'bob.j@example.com', '512-555-0102'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'Maria', 'Garcia', 'maria.g@example.com', '512-555-0103')
ON CONFLICT (id) DO NOTHING;

-- Example vendors
INSERT INTO vendors (id, organization_id, company_name, contact_name, email, specialties, hourly_rate, is_preferred)
VALUES
  ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000001', 'QuickFix Plumbing', 'Mike Wilson', 'mike@quickfix.com', ARRAY['plumbing'], 85, true),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'Sparks Electric', 'Lisa Chen', 'lisa@sparks.com', ARRAY['electrical'], 95, true),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'CoolBreeze HVAC', 'Tom Davis', 'tom@coolbreeze.com', ARRAY['hvac'], 110, false)
ON CONFLICT (id) DO NOTHING;
