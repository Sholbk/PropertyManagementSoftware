"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SelectOption { value: string; label: string }

interface InspectionFormProps {
  properties: SelectOption[];
  units: SelectOption[];
  teamMembers: SelectOption[];
}

const TYPES = [
  { value: "move_in", label: "Move-In" },
  { value: "move_out", label: "Move-Out" },
  { value: "routine", label: "Routine" },
  { value: "safety", label: "Safety" },
  { value: "annual", label: "Annual" },
];

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function InspectionForm({ properties, units, teamMembers }: InspectionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    property_id: "",
    unit_id: "",
    inspection_type: "routine",
    scheduled_date: "",
    inspector_id: "",
    notes: "",
  });

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const filteredUnits = units.filter((u) => {
    if (!form.property_id) return true;
    return u.value.startsWith(form.property_id) || true; // Show all units; property filter handled by parent if needed
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to schedule inspection");
      setLoading(false);
      return;
    }

    router.push("/inspections");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Inspection Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Property *</label>
            <select value={form.property_id} onChange={(e) => set("property_id", e.target.value)} required className={inputClass}>
              <option value="">Select property</option>
              {properties.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Unit</label>
            <select value={form.unit_id} onChange={(e) => set("unit_id", e.target.value)} className={inputClass}>
              <option value="">All / Building-wide</option>
              {filteredUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Inspection Type *</label>
            <select value={form.inspection_type} onChange={(e) => set("inspection_type", e.target.value)} required className={inputClass}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Scheduled Date *</label>
            <input type="date" value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Inspector</label>
            <select value={form.inspector_id} onChange={(e) => set("inspector_id", e.target.value)} className={inputClass}>
              <option value="">Unassigned</option>
              {teamMembers.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Notes</label>
          <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} placeholder="Special instructions, areas to focus on..." />
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" loading={loading}>Schedule Inspection</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
