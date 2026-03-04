import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Admin client for Edge Functions.
 * Uses service_role key — bypasses RLS.
 * Use only inside Edge Functions, never on client.
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

/**
 * User-scoped client — respects RLS.
 * Pass the Authorization header from the incoming request.
 */
export function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );
}
