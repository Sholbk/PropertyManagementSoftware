"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "appliance", label: "Appliance" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function TenantMaintenancePage() {
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchRequests = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!tenant) return;

    const { data } = await supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, category, reported_at, ai_summary")
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .order("reported_at", { ascending: false })
      .limit(20);

    setRequests(data ?? []);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, organization_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!tenant) return;

    // Get tenant's lease to find property/unit
    const { data: lease } = await supabase
      .from("leases")
      .select("property_id, unit_id")
      .eq("tenant_id", tenant.id)
      .in("status", ["active", "month_to_month"])
      .is("deleted_at", null)
      .maybeSingle();

    if (!lease) {
      setLoading(false);
      return;
    }

    await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        category,
        priority: "medium",
        property_id: lease.property_id,
        unit_id: lease.unit_id,
        tenant_id: tenant.id,
        entry_permitted: true,
      }),
    });

    setSuccess(true);
    setShowForm(false);
    setTitle("");
    setDescription("");
    setLoading(false);
    fetchRequests();
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Requests</h1>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "New Request"}</Button>
      </div>

      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Request submitted. Our team will review it shortly.
        </div>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">What needs fixing?</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Leaking faucet, broken AC, etc." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Details</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Please describe the issue..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <Button type="submit" loading={loading}>Submit Request</Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {requests.map((req) => (
          <Card key={req.id as string}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{req.title as string}</h3>
                <p className="text-sm text-gray-500">{new Date(req.reported_at as string).toLocaleDateString()} | {(req.category as string).replace(/_/g, " ")}</p>
                {(req.ai_summary as string | null) && <p className="mt-1 text-sm text-gray-600">{String(req.ai_summary)}</p>}
              </div>
              <Badge variant={(req.status as string) === "resolved" ? "success" : (req.status as string) === "new" ? "danger" : "warning"}>
                {(req.status as string).replace(/_/g, " ")}
              </Badge>
            </div>
          </Card>
        ))}
        {requests.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No maintenance requests yet</p>}
      </div>
    </div>
  );
}
