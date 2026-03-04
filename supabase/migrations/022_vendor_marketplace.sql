-- ============================================================================
-- 022_vendor_marketplace.sql — Vendor marketplace profiles, reviews, leads
-- ============================================================================

-- Marketplace profiles (platform-wide, NOT org-scoped)
CREATE TABLE IF NOT EXISTS vendor_marketplace_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    company_name        TEXT NOT NULL,
    contact_name        TEXT,
    email               TEXT NOT NULL,
    phone               TEXT,
    website             TEXT,
    description         TEXT,
    logo_url            TEXT,
    address             TEXT,
    city                TEXT,
    state               TEXT NOT NULL,
    zip                 TEXT,
    service_area_miles  INT DEFAULT 50,
    specialties         TEXT[] NOT NULL DEFAULT '{}',
    hourly_rate_min     NUMERIC(8, 2),
    hourly_rate_max     NUMERIC(8, 2),
    license_number      TEXT,
    insurance_verified  BOOLEAN DEFAULT false,
    insurance_expiry    DATE,
    years_in_business   INT,
    is_verified         BOOLEAN DEFAULT false,
    is_active           BOOLEAN DEFAULT true,
    listing_tier        TEXT NOT NULL DEFAULT 'free' CHECK (listing_tier IN ('free', 'featured', 'premium')),
    stripe_account_id   TEXT,
    rating_avg          NUMERIC(3, 2) DEFAULT 0,
    rating_count        INT DEFAULT 0,
    profile_views       INT DEFAULT 0,
    lead_count          INT DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vmp_state
  ON vendor_marketplace_profiles(state) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vmp_specialties
  ON vendor_marketplace_profiles USING GIN (specialties) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vmp_user
  ON vendor_marketplace_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_rating
  ON vendor_marketplace_profiles(rating_avg DESC) WHERE is_active = true;

ALTER TABLE vendor_marketplace_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view active marketplace profiles"
  ON vendor_marketplace_profiles FOR SELECT USING (is_active = true);

CREATE POLICY "vendors manage own profile"
  ON vendor_marketplace_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON vendor_marketplace_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Vendor Reviews
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_reviews (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_marketplace_profile_id   UUID NOT NULL REFERENCES vendor_marketplace_profiles(id),
    organization_id                 UUID NOT NULL REFERENCES organizations(id),
    work_order_id                   UUID REFERENCES work_orders(id),
    reviewer_id                     UUID NOT NULL REFERENCES users(id),
    rating                          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text                     TEXT,
    response_text                   TEXT,
    response_at                     TIMESTAMPTZ,
    is_public                       BOOLEAN DEFAULT true,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vr_profile
  ON vendor_reviews(vendor_marketplace_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vr_org
  ON vendor_reviews(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vr_unique_wo
  ON vendor_reviews(work_order_id) WHERE work_order_id IS NOT NULL;

ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view public reviews" ON vendor_reviews
    FOR SELECT USING (is_public = true);

CREATE POLICY "org members create reviews" ON vendor_reviews
    FOR INSERT WITH CHECK (
        organization_id = auth_org_id()
        AND auth_has_role(ARRAY['owner', 'property_manager'])
    );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON vendor_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Vendor Leads (connection requests)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_leads (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_marketplace_profile_id   UUID NOT NULL REFERENCES vendor_marketplace_profiles(id),
    organization_id                 UUID NOT NULL REFERENCES organizations(id),
    requested_by                    UUID NOT NULL REFERENCES users(id),
    message                         TEXT,
    status                          TEXT NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    specialty_needed                TEXT,
    responded_at                    TIMESTAMPTZ,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vl_vendor
  ON vendor_leads(vendor_marketplace_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_vl_org
  ON vendor_leads(organization_id, created_at DESC);

ALTER TABLE vendor_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view own leads" ON vendor_leads
    FOR SELECT USING (organization_id = auth_org_id());

CREATE POLICY "vendors view leads to them" ON vendor_leads
    FOR SELECT USING (
        vendor_marketplace_profile_id IN (
            SELECT id FROM vendor_marketplace_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "org members create leads" ON vendor_leads
    FOR INSERT WITH CHECK (organization_id = auth_org_id());

-- ============================================================================
-- Link existing vendors table to marketplace profiles
-- ============================================================================

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS marketplace_profile_id UUID REFERENCES vendor_marketplace_profiles(id);

CREATE INDEX IF NOT EXISTS idx_vendors_mp
  ON vendors(marketplace_profile_id) WHERE marketplace_profile_id IS NOT NULL;
