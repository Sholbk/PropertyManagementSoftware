import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await request.json();
  const { title, description, category, priority, property_id, unit_id, entry_permitted, entry_notes } = body;

  if (!title || !category || !property_id) {
    return NextResponse.json({ error: "Title, category, and property are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({
      organization_id: orgId,
      property_id,
      unit_id: unit_id || null,
      reported_by: user.id,
      title,
      description: description || null,
      category,
      priority: priority || "medium",
      status: "new",
      entry_permitted: entry_permitted ?? true,
      entry_notes: entry_notes || null,
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
  const { id, status, resolution_rating, resolution_feedback } = body;

  if (!id) return NextResponse.json({ error: "Request ID is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    if (status === "resolved") updates.resolved_at = new Date().toISOString();
    if (status === "acknowledged") updates.acknowledged_at = new Date().toISOString();
  }
  if (resolution_rating) updates.resolution_rating = resolution_rating;
  if (resolution_feedback) updates.resolution_feedback = resolution_feedback;

  const { error } = await supabase
    .from("maintenance_requests")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}
