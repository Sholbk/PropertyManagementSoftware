"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useOrg() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setOrgId(user.app_metadata?.active_org_id ?? null);
        setUserId(user.id);
        setUserEmail(user.email ?? null);
      }
    });
  }, []);

  return { orgId, userId, userEmail };
}
