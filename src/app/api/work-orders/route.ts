import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { maintenance_request_id, property_id, unit_id, title, description, category, priority,
    vendor_id, assigned_to, scheduled_date, scheduled_window, due_date } = body;

  if (!property_id || !title || !category) {
    return NextResponse.json({ error: "Property, title, and category are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      organization_id: orgId,
      maintenance_request_id: maintenance_request_id || null,
      property_id,
      unit_id: unit_id || null,
      created_by: user.id,
      title,
      description: description || null,
      category,
      priority: priority || "medium",
      status: vendor_id || assigned_to ? "assigned" : "open",
      vendor_id: vendor_id || null,
      assigned_to: assigned_to || null,
      assigned_at: vendor_id || assigned_to ? new Date().toISOString() : null,
      scheduled_date: scheduled_date || null,
      scheduled_window: scheduled_window || null,
      due_date: due_date || null,
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
  const { id, status, vendor_id, assigned_to, resolution_notes, labor_hours, material_cost, labor_cost } = body;

  if (!id) return NextResponse.json({ error: "Work order ID is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    if (status === "in_progress" && !body.started_at) updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    if (status === "verified") updates.verified_at = new Date().toISOString();
  }
  if (vendor_id !== undefined) {
    updates.vendor_id = vendor_id || null;
    updates.assigned_at = new Date().toISOString();
  }
  if (assigned_to !== undefined) {
    updates.assigned_to = assigned_to || null;
    updates.assigned_at = new Date().toISOString();
  }
  if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
  if (labor_hours !== undefined) updates.labor_hours = labor_hours;
  if (material_cost !== undefined) updates.material_cost = material_cost;
  if (labor_cost !== undefined) updates.labor_cost = labor_cost;

  const { error } = await supabase
    .from("work_orders")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}
