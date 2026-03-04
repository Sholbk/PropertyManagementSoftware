import { createAdminClient, createUserClient } from "../_shared/supabase-admin.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Invite a team member to an organization.
 * Called by owners/PMs from the Team Settings page.
 * Sets org_id + role in the invited user's app_metadata.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is an owner or PM
    const userClient = createUserClient(authHeader);
    const { data: { user: caller } } = await userClient.auth.getUser();

    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerRole = caller.app_metadata?.role;
    const callerOrgId = caller.app_metadata?.org_id;

    if (!callerOrgId || !["owner", "property_manager"].includes(callerRole)) {
      return new Response(
        JSON.stringify({ error: "Only owners and property managers can invite users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, role, full_name } = await req.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "email and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PMs can't invite owners
    if (callerRole === "property_manager" && role === "owner") {
      return new Response(
        JSON.stringify({ error: "Property managers cannot invite owners" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createAdminClient();

    // Invite via Supabase Auth Admin API
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name ?? email.split("@")[0],
      },
      redirectTo: `${Deno.env.get("SITE_URL") ?? "https://pmpp.netlify.app"}/auth/callback`,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set the org_id and role in app_metadata
    if (data.user) {
      await adminClient.auth.admin.updateUserById(data.user.id, {
        app_metadata: {
          org_id: callerOrgId,
          role: role,
        },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: data.user?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
