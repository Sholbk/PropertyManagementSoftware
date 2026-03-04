import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { property_id, unit_number, bedrooms, bathrooms, sqft, market_rent, status, floor_number, notes } = body;

  if (!property_id || !unit_number) {
    return NextResponse.json({ error: "Property and unit number are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("units")
    .insert({
      organization_id: orgId,
      property_id,
      unit_number,
      bedrooms: bedrooms ?? null,
      bathrooms: bathrooms ?? null,
      sqft: sqft ?? null,
      market_rent: market_rent ?? null,
      status: status || "vacant",
      floor_number: floor_number ?? null,
      notes: notes ?? null,
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
  const { id, unit_number, bedrooms, bathrooms, sqft, market_rent, status, floor_number, notes } = body;

  if (!id) return NextResponse.json({ error: "Unit ID is required" }, { status: 400 });

  const { error } = await supabase
    .from("units")
    .update({
      unit_number,
      bedrooms: bedrooms ?? null,
      bathrooms: bathrooms ?? null,
      sqft: sqft ?? null,
      market_rent: market_rent ?? null,
      status: status || "vacant",
      floor_number: floor_number ?? null,
      notes: notes ?? null,
    })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}
