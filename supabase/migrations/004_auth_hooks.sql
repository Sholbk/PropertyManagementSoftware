-- ============================================================================
-- AUTH HOOKS — Triggered when Supabase Auth events occur
-- ============================================================================

-- ============================================================================
-- On new user signup: create organization + user record
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    user_role TEXT;
    user_org_id UUID;
BEGIN
    -- Check if this user was invited (org_id already in metadata)
    user_org_id := (NEW.raw_app_meta_data ->> 'org_id')::UUID;
    user_role := COALESCE(NEW.raw_app_meta_data ->> 'role', 'owner');

    IF user_org_id IS NULL THEN
        -- New signup — create a new organization
        INSERT INTO public.organizations (name, slug)
        VALUES (
            COALESCE(NEW.raw_user_meta_data ->> 'company_name', split_part(NEW.email, '@', 1)),
            LOWER(REPLACE(
                COALESCE(NEW.raw_user_meta_data ->> 'company_name', split_part(NEW.email, '@', 1)),
                ' ', '-'
            )) || '-' || substr(gen_random_uuid()::text, 1, 8)
        )
        RETURNING id INTO new_org_id;

        user_org_id := new_org_id;
        user_role := 'owner';

        -- Update auth metadata with org_id
        UPDATE auth.users
        SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
            'org_id', new_org_id::text,
            'role', 'owner'
        )
        WHERE id = NEW.id;
    END IF;

    -- Create the user record in public.users
    INSERT INTO public.users (id, org_id, email, full_name, role)
    VALUES (
        NEW.id,
        user_org_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
        user_role::user_role
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- On user login: update last_login_at
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
        UPDATE public.users
        SET last_login_at = now()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_login
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_login();

-- ============================================================================
-- On user deletion from auth: soft-delete in public.users
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users
    SET deleted_at = now(), is_active = false
    WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_deleted();
