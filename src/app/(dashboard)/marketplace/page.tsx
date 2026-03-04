import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrgPlan, canAccessFeature } from "@/lib/feature-gate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export const metadata = { title: "Vendor Marketplace | PMPP" };

export default async function MarketplacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  const orgPlan = await getOrgPlan(supabase, orgId);
  if (!orgPlan || !canAccessFeature(orgPlan, "marketplace_access")) {
    redirect("/settings/billing?upgrade=marketplace_access");
  }

  // Fetch active vendor profiles
  const { data: vendors } = await supabase
    .from("vendor_marketplace_profiles")
    .select("id, company_name, contact_name, state, city, specialties, hourly_rate_min, hourly_rate_max, rating_avg, rating_count, is_verified, listing_tier, description")
    .eq("is_active", true)
    .order("listing_tier", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Marketplace</h1>
      </div>

      {!vendors || vendors.length === 0 ? (
        <EmptyState
          title="No vendors listed yet"
          description="The vendor marketplace is growing. Check back soon!"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <Link key={vendor.id} href={`/marketplace/${vendor.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{vendor.company_name}</h3>
                    <p className="text-xs text-gray-500">{vendor.city}, {vendor.state}</p>
                  </div>
                  <div className="flex gap-1">
                    {vendor.is_verified && <Badge variant="success">Verified</Badge>}
                    {vendor.listing_tier !== "free" && (
                      <Badge variant="info">{vendor.listing_tier}</Badge>
                    )}
                  </div>
                </div>
                {vendor.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-gray-600">{vendor.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {(vendor.specialties ?? []).slice(0, 3).map((s: string) => (
                    <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{s}</span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {vendor.rating_avg > 0 ? `${Number(vendor.rating_avg).toFixed(1)} / 5 (${vendor.rating_count})` : "No reviews"}
                  </span>
                  {(vendor.hourly_rate_min || vendor.hourly_rate_max) && (
                    <span>
                      ${vendor.hourly_rate_min ?? "?"} – ${vendor.hourly_rate_max ?? "?"}/hr
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
