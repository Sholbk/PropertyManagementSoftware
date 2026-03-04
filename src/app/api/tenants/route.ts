import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { first_name, last_name, email, phone, date_of_birth, income_annual, employer, emergency_contact, notes } = body;

  if (!first_name || !last_name) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      organization_id: orgId,
      first_name,
      last_name,
      email: email || null,
      phone: phone || null,
      date_of_birth: date_of_birth || null,
      income_annual: income_annual || null,
      employer: employer || null,
      emergency_contact: emergency_contact || null,
      notes: notes || null,
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
  const { id, first_name, last_name, email, phone, date_of_birth, income_annual, employer, emergency_contact, notes } = body;

  if (!id) return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });

  const { error } = await supabase
    .from("tenants")
    .update({
      first_name,
      last_name,
      email: email || null,
      phone: phone || null,
      date_of_birth: date_of_birth || null,
      income_annual: income_annual || null,
      employer: employer || null,
      emergency_contact: emergency_contact || null,
      notes: notes || null,
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
  if (!id) return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });

  const { error } = await supabase
    .from("tenants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
