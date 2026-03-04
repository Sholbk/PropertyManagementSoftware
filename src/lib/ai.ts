import { createClient } from "@/lib/supabase/client";

export async function runRevenueLeakageScan(organizationId: string, propertyId?: string) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = await supabase.functions.invoke("ai-revenue-leakage", {
    body: {
      organization_id: organizationId,
      property_id: propertyId,
      user_id: session?.user.id,
    },
  });

  return response.data;
}

export async function runLeaseAdvisor(leaseId: string) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = await supabase.functions.invoke("ai-lease-advisor", {
    body: { lease_id: leaseId, user_id: session?.user.id },
  });

  return response.data;
}

export async function runAnomalyDetection(organizationId: string) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = await supabase.functions.invoke("ai-anomaly-detect", {
    body: { organization_id: organizationId, user_id: session?.user.id },
  });

  return response.data;
}
