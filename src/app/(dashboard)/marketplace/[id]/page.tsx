import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getOrgPlan, canAccessFeature } from "@/lib/feature-gate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/dashboard");

  const orgPlan = await getOrgPlan(supabase, orgId);
  if (!orgPlan || !canAccessFeature(orgPlan, "marketplace_access")) {
    redirect("/settings/billing?upgrade=marketplace_access");
  }

  const { data: vendor } = await supabase
    .from("vendor_marketplace_profiles")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!vendor) notFound();

  // Fetch reviews
  const { data: reviews } = await supabase
    .from("vendor_reviews")
    .select("id, rating, review_text, response_text, created_at")
    .eq("vendor_marketplace_profile_id", id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Marketplace", href: "/marketplace" },
        { label: vendor.company_name },
      ]} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vendor.company_name}</h1>
          <p className="text-sm text-gray-500">
            {vendor.city}, {vendor.state} {vendor.zip}
          </p>
        </div>
        <div className="flex gap-2">
          {vendor.is_verified && <Badge variant="success">Verified</Badge>}
          {vendor.listing_tier !== "free" && <Badge variant="info">{vendor.listing_tier}</Badge>}
        </div>
      </div>

      {/* Details */}
      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          {vendor.contact_name && (
            <div>
              <p className="text-gray-500">Contact</p>
              <p className="font-medium">{vendor.contact_name}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium">{vendor.email}</p>
          </div>
          {vendor.phone && (
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium">{vendor.phone}</p>
            </div>
          )}
          {vendor.website && (
            <div>
              <p className="text-gray-500">Website</p>
              <p className="font-medium">{vendor.website}</p>
            </div>
          )}
          {vendor.years_in_business && (
            <div>
              <p className="text-gray-500">Experience</p>
              <p className="font-medium">{vendor.years_in_business} years</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Service Area</p>
            <p className="font-medium">{vendor.service_area_miles} miles</p>
          </div>
          {(vendor.hourly_rate_min || vendor.hourly_rate_max) && (
            <div>
              <p className="text-gray-500">Rate</p>
              <p className="font-medium">${vendor.hourly_rate_min} – ${vendor.hourly_rate_max}/hr</p>
            </div>
          )}
          {vendor.license_number && (
            <div>
              <p className="text-gray-500">License</p>
              <p className="font-medium">{vendor.license_number}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Rating</p>
            <p className="font-medium">
              {vendor.rating_avg > 0 ? `${Number(vendor.rating_avg).toFixed(1)} / 5 (${vendor.rating_count} reviews)` : "No reviews yet"}
            </p>
          </div>
        </div>
      </Card>

      {/* Specialties */}
      {vendor.specialties?.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Specialties</h3>
          <div className="flex flex-wrap gap-2">
            {vendor.specialties.map((s: string) => (
              <span key={s} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{s}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Description */}
      {vendor.description && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">About</h3>
          <p className="text-sm text-gray-600 whitespace-pre-line">{vendor.description}</p>
        </Card>
      )}

      {/* Reviews */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Reviews ({reviews?.length ?? 0})
        </h3>
        {reviews && reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-md border border-gray-100 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-yellow-600">
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.review_text && <p className="mt-1 text-sm text-gray-700">{r.review_text}</p>}
                {r.response_text && (
                  <div className="mt-2 rounded bg-gray-50 p-2">
                    <p className="text-xs font-medium text-gray-500">Vendor Response:</p>
                    <p className="text-sm text-gray-600">{r.response_text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No reviews yet</p>
        )}
      </Card>
    </div>
  );
}
