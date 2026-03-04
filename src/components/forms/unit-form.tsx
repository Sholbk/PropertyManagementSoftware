"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const UNIT_STATUSES = [
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "maintenance", label: "Maintenance" },
  { value: "renovation", label: "Renovation" },
  { value: "off_market", label: "Off Market" },
];

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

interface UnitFormData {
  id?: string;
  unit_number: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  market_rent: string;
  status: string;
  floor_number: string;
  notes: string;
}

interface UnitFormProps {
  propertyId: string;
  initialData?: Partial<UnitFormData>;
  mode: "create" | "edit";
  backHref: string;
}

export function UnitForm({ propertyId, initialData, mode, backHref }: UnitFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<UnitFormData>({
    unit_number: initialData?.unit_number ?? "",
    bedrooms: initialData?.bedrooms ?? "",
    bathrooms: initialData?.bathrooms ?? "",
    sqft: initialData?.sqft ?? "",
    market_rent: initialData?.market_rent ?? "",
    status: initialData?.status ?? "vacant",
    floor_number: initialData?.floor_number ?? "",
    notes: initialData?.notes ?? "",
  });

  function updateField(field: keyof UnitFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      property_id: propertyId,
      unit_number: form.unit_number,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      sqft: form.sqft ? Number(form.sqft) : null,
      market_rent: form.market_rent ? Number(form.market_rent) : null,
      status: form.status,
      floor_number: form.floor_number ? Number(form.floor_number) : null,
      notes: form.notes || null,
      ...(mode === "edit" && initialData?.id ? { id: initialData.id } : {}),
    };

    try {
      const res = await fetch("/api/units", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save unit");
        setLoading(false);
        return;
      }

      router.push(backHref);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Unit Details</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="unit_number" className={labelClass}>Unit number</label>
              <input
                id="unit_number"
                type="text"
                required
                value={form.unit_number}
                onChange={(e) => updateField("unit_number", e.target.value)}
                className={inputClass}
                placeholder="101"
              />
            </div>
            <div>
              <label htmlFor="floor_number" className={labelClass}>Floor (optional)</label>
              <input
                id="floor_number"
                type="number"
                min="0"
                value={form.floor_number}
                onChange={(e) => updateField("floor_number", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="bedrooms" className={labelClass}>Bedrooms</label>
              <input
                id="bedrooms"
                type="number"
                min="0"
                value={form.bedrooms}
                onChange={(e) => updateField("bedrooms", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="bathrooms" className={labelClass}>Bathrooms</label>
              <input
                id="bathrooms"
                type="number"
                min="0"
                step="0.5"
                value={form.bathrooms}
                onChange={(e) => updateField("bathrooms", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="sqft" className={labelClass}>Sq ft</label>
              <input
                id="sqft"
                type="number"
                min="0"
                value={form.sqft}
                onChange={(e) => updateField("sqft", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="market_rent" className={labelClass}>Market rent ($/mo)</label>
              <input
                id="market_rent"
                type="number"
                min="0"
                step="0.01"
                value={form.market_rent}
                onChange={(e) => updateField("market_rent", e.target.value)}
                className={inputClass}
                placeholder="1200"
              />
            </div>
            <div>
              <label htmlFor="status" className={labelClass}>Status</label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                className={inputClass}
              >
                {UNIT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className={labelClass}>Notes (optional)</label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className={inputClass}
              placeholder="Corner unit, recently renovated..."
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {mode === "create" ? "Add Unit" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
