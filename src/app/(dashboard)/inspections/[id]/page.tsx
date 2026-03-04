"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusFlow: Record<string, string[]> = {
  scheduled: ["in_progress"],
  in_progress: ["passed", "failed", "needs_followup"],
  needs_followup: ["in_progress", "passed", "failed"],
};

const resultOptions = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "conditional", label: "Conditional" },
];

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inspection, setInspection] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("");
  const [followUp, setFollowUp] = useState(false);

  const fetch_ = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("inspections")
      .select("*, properties(name), units(unit_number)")
      .eq("id", id)
      .single();
    if (data) {
      setInspection(data);
      setNotes((data.notes as string) ?? "");
      setResult((data.overall_result as string) ?? "");
      setFollowUp(data.follow_up_required as boolean);
    }
  }, [id]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch("/api/inspections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status: newStatus,
        overall_result: result || undefined,
        notes,
        follow_up_required: followUp,
      }),
    });
    await fetch_();
    setLoading(false);
  }

  if (!inspection) return <div className="py-12 text-center text-gray-400">Loading...</div>;

  const property = inspection.properties as Record<string, string> | null;
  const unit = inspection.units as Record<string, string> | null;
  const status = inspection.status as string;
  const nextStatuses = statusFlow[status] ?? [];

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/inspections")} className="text-sm text-blue-600 hover:underline">&larr; Back to Inspections</button>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {(inspection.inspection_type as string).replace(/_/g, " ")} Inspection
        </h1>
        <Badge variant={status === "passed" ? "success" : status === "failed" ? "danger" : status === "in_progress" ? "warning" : "neutral"}>
          {status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Property</span><span>{property?.name ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Unit</span><span>{unit?.unit_number ?? "All"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Scheduled</span><span>{inspection.scheduled_date as string}</span></div>
            {(inspection.completed_date as string | null) && <div className="flex justify-between"><span className="text-gray-500">Completed</span><span>{String(inspection.completed_date)}</span></div>}
            {(inspection.overall_result as string | null) && (
              <div className="flex justify-between">
                <span className="text-gray-500">Result</span>
                <Badge variant={(inspection.overall_result as string) === "pass" ? "success" : (inspection.overall_result as string) === "fail" ? "danger" : "warning"}>
                  {inspection.overall_result as string}
                </Badge>
              </div>
            )}
          </div>
        </Card>

        {nextStatuses.length > 0 && (
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Update Inspection</h3>
            <div className="space-y-3">
              {(status === "in_progress" || status === "needs_followup") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Overall Result</label>
                    <select value={result} onChange={(e) => setResult(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                      <option value="">Not yet determined</option>
                      {resultOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="followup" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
                    <label htmlFor="followup" className="text-sm text-gray-700">Follow-up required</label>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((ns) => (
                  <Button key={ns} onClick={() => updateStatus(ns)} loading={loading} variant={ns === "passed" ? "primary" : ns === "failed" ? "danger" : "secondary"}>
                    {ns === "in_progress" ? "Start Inspection" : ns === "passed" ? "Mark Passed" : ns === "failed" ? "Mark Failed" : ns.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
