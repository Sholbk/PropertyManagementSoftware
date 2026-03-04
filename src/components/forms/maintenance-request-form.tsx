"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "appliance", label: "Appliance" },
  { value: "structural", label: "Structural" },
  { value: "pest", label: "Pest Control" },
  { value: "landscaping", label: "Landscaping" },
  { value: "safety", label: "Safety" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "emergency", label: "Emergency" },
];

const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

interface SelectOption { id: string; label: string }

interface MaintenanceRequestFormProps {
  properties: SelectOption[];
  units: SelectOption[];
}

export function MaintenanceRequestForm({ properties, units }: MaintenanceRequestFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [entryPermitted, setEntryPermitted] = useState(true);
  const [entryNotes, setEntryNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description: description || null, category, priority,
          property_id: propertyId, unit_id: unitId || null,
          entry_permitted: entryPermitted, entry_notes: entryNotes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit request");
        setLoading(false);
        return;
      }

      router.push("/maintenance");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Request Details</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className={labelClass}>Title</label>
            <input id="title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Leaking faucet in kitchen" />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Describe the issue in detail..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className={labelClass}>Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className={labelClass}>Priority</label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Location</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="property_id" className={labelClass}>Property</label>
            <select id="property_id" required value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={inputClass}>
              <option value="">Select property</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="unit_id" className={labelClass}>Unit (optional)</label>
            <select id="unit_id" value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputClass}>
              <option value="">Common area / N/A</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Entry Permission</h2>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={entryPermitted} onChange={(e) => setEntryPermitted(e.target.checked)} className="rounded border-gray-300" />
          Permission to enter unit
        </label>
        {entryPermitted && (
          <div className="mt-3">
            <label htmlFor="entry_notes" className={labelClass}>Entry notes</label>
            <input id="entry_notes" type="text" value={entryNotes} onChange={(e) => setEntryNotes(e.target.value)} className={inputClass} placeholder="Key under mat, available after 9am..." />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={loading}>Submit Request</Button>
      </div>
    </form>
  );
}
