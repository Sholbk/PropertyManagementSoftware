import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { property_id, unit_id, inspection_type, scheduled_date, inspector_id, notes } = body;

  if (!property_id || !inspection_type || !scheduled_date) {
    return NextResponse.json({ error: "Property, type, and date are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("inspections")
    .insert({
      organization_id: orgId,
      property_id,
      unit_id: unit_id || null,
      inspection_type,
      scheduled_date,
      inspector_id: inspector_id || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, status, overall_result, findings, notes, completed_date, follow_up_required, follow_up_deadline } = body;

  if (!id) return NextResponse.json({ error: "Inspection ID is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (overall_result) updates.overall_result = overall_result;
  if (findings !== undefined) updates.findings = findings;
  if (notes !== undefined) updates.notes = notes;
  if (completed_date) updates.completed_date = completed_date;
  if (follow_up_required !== undefined) updates.follow_up_required = follow_up_required;
  if (follow_up_deadline) updates.follow_up_deadline = follow_up_deadline;

  // Auto-set completed_date when status transitions to passed/failed
  if (status === "passed" || status === "failed") {
    updates.completed_date = updates.completed_date || new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase.from("inspections").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
