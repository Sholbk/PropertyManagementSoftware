import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NotificationParams {
  organization_id: string;
  user_id: string;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
}

/**
 * Insert a single notification.
 */
export async function createNotification(
  supabase: SupabaseClient,
  params: NotificationParams
) {
  const { error } = await supabase.from("notifications").insert({
    organization_id: params.organization_id,
    user_id: params.user_id,
    title: params.title,
    body: params.body,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
  });
  if (error) console.error("Notification insert error:", error.message);
}

/**
 * Notify all active members with any of the specified roles in an org.
 */
export async function notifyByRole(
  supabase: SupabaseClient,
  params: {
    organization_id: string;
    roles: string[];
    title: string;
    body: string;
    entity_type?: string;
    entity_id?: string;
  }
) {
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", params.organization_id)
    .in("role", params.roles)
    .eq("status", "active");

  for (const member of members ?? []) {
    await createNotification(supabase, {
      organization_id: params.organization_id,
      user_id: member.user_id,
      title: params.title,
      body: params.body,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
    });
  }
}
