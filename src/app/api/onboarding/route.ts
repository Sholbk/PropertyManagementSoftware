import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { orgName, timezone, property } = body as {
    orgName: string;
    timezone: string;
    property?: {
      name: string;
      property_type: string;
      address_line1: string;
      city: string;
      state: string;
      zip: string;
    };
  };

  if (!orgName || !timezone) {
    return NextResponse.json({ error: "Organization name and timezone are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create organization
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    + "-" + crypto.randomUUID().slice(0, 8);

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: orgName,
      slug,
      timezone,
      plan: "free",
      subscription_status: "active",
    })
    .select("id")
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message ?? "Failed to create organization" }, { status: 500 });
  }

  // Create membership (owner role)
  const { error: membershipError } = await admin
    .from("memberships")
    .insert({
      user_id: user.id,
      organization_id: org.id,
      role: "owner",
      status: "active",
    });

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  // Set active_org_id in user metadata
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      active_org_id: org.id,
      role: "owner",
    },
  });

  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 500 });
  }

  // Optionally create first property
  if (property) {
    const { error: propError } = await admin
      .from("properties")
      .insert({
        organization_id: org.id,
        name: property.name,
        property_type: property.property_type,
        address_line1: property.address_line1,
        city: property.city,
        state: property.state,
        zip: property.zip,
      });

    if (propError) {
      // Non-fatal: org is created, property can be added later
      console.error("Failed to create property during onboarding:", propError.message);
    }
  }

  return NextResponse.json({ orgId: org.id });
}
