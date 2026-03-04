import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { company_name, contact_name, email, phone, address, specialties, hourly_rate,
    license_number, insurance_provider, insurance_expiry, w9_on_file, is_preferred, notes } = body;

  if (!company_name) return NextResponse.json({ error: "Company name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      organization_id: orgId,
      company_name,
      contact_name: contact_name || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      specialties: specialties || [],
      hourly_rate: hourly_rate ?? null,
      license_number: license_number || null,
      insurance_provider: insurance_provider || null,
      insurance_expiry: insurance_expiry || null,
      w9_on_file: w9_on_file ?? false,
      is_preferred: is_preferred ?? false,
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
  const { id, company_name, contact_name, email, phone, address, specialties, hourly_rate,
    license_number, insurance_provider, insurance_expiry, w9_on_file, is_preferred, notes } = body;

  if (!id) return NextResponse.json({ error: "Vendor ID is required" }, { status: 400 });

  const { error } = await supabase
    .from("vendors")
    .update({
      company_name,
      contact_name: contact_name || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      specialties: specialties || [],
      hourly_rate: hourly_rate ?? null,
      license_number: license_number || null,
      insurance_provider: insurance_provider || null,
      insurance_expiry: insurance_expiry || null,
      w9_on_file: w9_on_file ?? false,
      is_preferred: is_preferred ?? false,
      notes: notes || null,
    })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}
