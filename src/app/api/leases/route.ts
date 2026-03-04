import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { property_id, unit_id, tenant_id, lease_type, status, start_date, end_date, monthly_rent,
    security_deposit, pet_deposit, rent_due_day, late_fee_amount, late_fee_grace_days, escalation_pct, move_in_date } = body;

  if (!property_id || !unit_id || !tenant_id || !start_date || !monthly_rent) {
    return NextResponse.json({ error: "Property, unit, tenant, start date, and monthly rent are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leases")
    .insert({
      organization_id: orgId,
      property_id,
      unit_id,
      tenant_id,
      lease_type: lease_type || "fixed",
      status: status || "draft",
      start_date,
      end_date: end_date || null,
      monthly_rent,
      security_deposit: security_deposit ?? null,
      pet_deposit: pet_deposit ?? null,
      rent_due_day: rent_due_day || 1,
      late_fee_amount: late_fee_amount ?? null,
      late_fee_grace_days: late_fee_grace_days ?? null,
      escalation_pct: escalation_pct ?? null,
      move_in_date: move_in_date || null,
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
  const { id, property_id, unit_id, tenant_id, lease_type, status, start_date, end_date, monthly_rent,
    security_deposit, pet_deposit, rent_due_day, late_fee_amount, late_fee_grace_days, escalation_pct, move_in_date } = body;

  if (!id) return NextResponse.json({ error: "Lease ID is required" }, { status: 400 });

  const { error } = await supabase
    .from("leases")
    .update({
      property_id,
      unit_id,
      tenant_id,
      lease_type,
      status,
      start_date,
      end_date: end_date || null,
      monthly_rent,
      security_deposit: security_deposit ?? null,
      pet_deposit: pet_deposit ?? null,
      rent_due_day,
      late_fee_amount: late_fee_amount ?? null,
      late_fee_grace_days: late_fee_grace_days ?? null,
      escalation_pct: escalation_pct ?? null,
      move_in_date: move_in_date || null,
    })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}
