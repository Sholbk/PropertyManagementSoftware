-- ============================================================================
-- STORAGE BUCKETS + RLS POLICIES
-- ============================================================================
-- File path convention: {org_id}/{entity_type}/{entity_id}/{filename}
-- Example: abc123/work-orders/wo456/before-photo.jpg
-- Example: abc123/leases/lease789/signed-lease.pdf
-- ============================================================================

-- Property documents: leases, inspections, insurance, etc.
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-documents', 'property-documents', false);

-- Work order photos: before/during/after
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', false);

-- Vendor files: W9s, insurance certificates, licenses
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-files', 'vendor-files', false);

-- Org branding: logos, email templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', true);  -- public for logo display

-- ============================================================================
-- STORAGE RLS — org-scoped via folder path
-- ============================================================================

-- property-documents: org members can read, managers can write
CREATE POLICY "prop_docs_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'property-documents'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
    );

CREATE POLICY "prop_docs_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'property-documents'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'property_manager', 'leasing_agent')
    );

CREATE POLICY "prop_docs_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'property-documents'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'property_manager')
    );

-- work-order-photos: anyone in org can upload (including techs and residents)
CREATE POLICY "wo_photos_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'work-order-photos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
    );

CREATE POLICY "wo_photos_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'work-order-photos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
    );

-- vendor-files: managers upload, vendors can see their own (enforced by folder path)
CREATE POLICY "vendor_files_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'vendor-files'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
    );

CREATE POLICY "vendor_files_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'vendor-files'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'property_manager')
    );

-- org-assets: owners only
CREATE POLICY "org_assets_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'org-assets'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    );
