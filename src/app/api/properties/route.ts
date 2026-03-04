import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { name, property_type, address_line1, address_line2, city, state, zip, year_built, total_sqft } = body;

  if (!name || !property_type || !address_line1 || !city || !state || !zip) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({
      organization_id: orgId,
      name,
      property_type,
      address_line1,
      address_line2: address_line2 || null,
      city,
      state,
      zip,
      year_built: year_built || null,
      total_sqft: total_sqft || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { id, name, property_type, address_line1, address_line2, city, state, zip, year_built, total_sqft } = body;

  if (!id) return NextResponse.json({ error: "Property ID is required" }, { status: 400 });

  const { error } = await supabase
    .from("properties")
    .update({
      name,
      property_type,
      address_line1,
      address_line2: address_line2 || null,
      city,
      state,
      zip,
      year_built: year_built || null,
      total_sqft: total_sqft || null,
    })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Property ID is required" }, { status: 400 });

  // Soft delete
  const { error } = await supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
