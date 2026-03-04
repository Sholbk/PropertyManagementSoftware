"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const statusFlow: Record<string, string[]> = {
  open: ["assigned"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["pending_parts", "pending_vendor", "completed"],
  pending_parts: ["in_progress"],
  pending_vendor: ["in_progress"],
  completed: ["verified"],
  verified: ["closed"],
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  open: "neutral",
  assigned: "info",
  in_progress: "warning",
  pending_parts: "warning",
  pending_vendor: "warning",
  completed: "success",
  verified: "success",
  closed: "success",
  cancelled: "danger",
};

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [wo, setWo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [materialCost, setMaterialCost] = useState("");
  const [laborCost, setLaborCost] = useState("");

  const fetchWo = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("work_orders")
      .select("*, properties(name), units(unit_number), vendors(company_name)")
      .eq("id", id)
      .single();
    if (data) {
      setWo(data);
      setResolutionNotes((data.resolution_notes as string) ?? "");
      setLaborHours(data.labor_hours?.toString() ?? "");
      setMaterialCost(data.material_cost?.toString() ?? "");
      setLaborCost(data.labor_cost?.toString() ?? "");
    }
  }, [id]);

  useEffect(() => { fetchWo(); }, [fetchWo]);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    const payload: Record<string, unknown> = { id, status: newStatus };
    if (newStatus === "completed") {
      payload.resolution_notes = resolutionNotes || null;
      payload.labor_hours = laborHours ? Number(laborHours) : null;
      payload.material_cost = materialCost ? Number(materialCost) : null;
      payload.labor_cost = laborCost ? Number(laborCost) : null;
    }
    await fetch("/api/work-orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await fetchWo();
    setLoading(false);
    router.refresh();
  }

  if (!wo) return <div className="p-6 text-gray-400">Loading...</div>;

  const property = wo.properties as { name: string } | null;
  const unit = wo.units as { unit_number: string } | null;
  const vendor = wo.vendors as { company_name: string } | null;
  const status = wo.status as string;
  const nextStatuses = statusFlow[status] ?? [];
  const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{wo.title as string}</h1>
        <Badge variant={statusVariant[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Details</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Property</dt><dd>{property?.name}</dd></div>
            {unit && <div><dt className="text-gray-500">Unit</dt><dd>{unit.unit_number}</dd></div>}
            <div><dt className="text-gray-500">Category</dt><dd className="capitalize">{wo.category as string}</dd></div>
            <div><dt className="text-gray-500">Priority</dt><dd className="capitalize">{wo.priority as string}</dd></div>
            {vendor && <div><dt className="text-gray-500">Vendor</dt><dd>{vendor.company_name}</dd></div>}
            {(wo.scheduled_date as string | null) && <div><dt className="text-gray-500">Scheduled</dt><dd>{String(wo.scheduled_date)}</dd></div>}
          </dl>
          {(wo.description as string | null) && <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{String(wo.description)}</p>}
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Cost Tracking</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Labor Hours</dt><dd>{wo.labor_hours ? `${wo.labor_hours}h` : "—"}</dd></div>
            <div><dt className="text-gray-500">Material Cost</dt><dd>{wo.material_cost ? formatCurrency(wo.material_cost as number) : "—"}</dd></div>
            <div><dt className="text-gray-500">Labor Cost</dt><dd>{wo.labor_cost ? formatCurrency(wo.labor_cost as number) : "—"}</dd></div>
            <div><dt className="text-gray-500 font-medium">Total</dt><dd className="font-medium">{wo.total_cost ? formatCurrency(wo.total_cost as number) : "—"}</dd></div>
          </dl>
        </Card>
      </div>

      {/* Completion form (show when completing) */}
      {status === "in_progress" && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Completion Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Resolution Notes</label>
              <textarea rows={3} value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} className={inputClass} placeholder="What was done to resolve the issue..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Labor Hours</label>
                <input type="number" min="0" step="0.5" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Material Cost ($)</label>
                <input type="number" min="0" step="0.01" value={materialCost} onChange={(e) => setMaterialCost(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Labor Cost ($)</label>
                <input type="number" min="0" step="0.01" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Status transitions */}
      {nextStatuses.length > 0 && (
        <div className="flex gap-3">
          {nextStatuses.map((next) => (
            <Button
              key={next}
              variant={next === "cancelled" ? "danger" : "primary"}
              loading={loading}
              onClick={() => updateStatus(next)}
            >
              {next === "in_progress" ? "Start Work" : next === "completed" ? "Mark Complete" : next === "verified" ? "Verify" : next === "closed" ? "Close" : next === "assigned" ? "Assign" : next === "cancelled" ? "Cancel" : next.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      )}

      {(wo.resolution_notes as string | null) && status !== "in_progress" && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Resolution</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{wo.resolution_notes as string}</p>
        </Card>
      )}
    </div>
  );
}
