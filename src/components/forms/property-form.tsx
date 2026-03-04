"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "multi_family", label: "Multi Family" },
  { value: "commercial", label: "Commercial" },
  { value: "mixed_use", label: "Mixed Use" },
  { value: "industrial", label: "Industrial" },
];

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

interface PropertyFormData {
  id?: string;
  name: string;
  property_type: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  year_built: string;
  total_sqft: string;
}

interface PropertyFormProps {
  initialData?: Partial<PropertyFormData>;
  mode: "create" | "edit";
}

export function PropertyForm({ initialData, mode }: PropertyFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<PropertyFormData>({
    name: initialData?.name ?? "",
    property_type: initialData?.property_type ?? "multi_family",
    address_line1: initialData?.address_line1 ?? "",
    address_line2: initialData?.address_line2 ?? "",
    city: initialData?.city ?? "",
    state: initialData?.state ?? "",
    zip: initialData?.zip ?? "",
    year_built: initialData?.year_built ?? "",
    total_sqft: initialData?.total_sqft ?? "",
  });

  function updateField(field: keyof PropertyFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      ...form,
      year_built: form.year_built ? Number(form.year_built) : null,
      total_sqft: form.total_sqft ? Number(form.total_sqft) : null,
      ...(mode === "edit" && initialData?.id ? { id: initialData.id } : {}),
    };

    try {
      const res = await fetch("/api/properties", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save property");
        setLoading(false);
        return;
      }

      const data = await res.json();
      router.push(`/properties/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Property Details</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>Property name</label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className={inputClass}
              placeholder="Sunset Apartments"
            />
          </div>

          <div>
            <label htmlFor="property_type" className={labelClass}>Property type</label>
            <select
              id="property_type"
              value={form.property_type}
              onChange={(e) => updateField("property_type", e.target.value)}
              className={inputClass}
            >
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Address</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="address_line1" className={labelClass}>Street address</label>
            <input
              id="address_line1"
              type="text"
              required
              value={form.address_line1}
              onChange={(e) => updateField("address_line1", e.target.value)}
              className={inputClass}
              placeholder="123 Main St"
            />
          </div>

          <div>
            <label htmlFor="address_line2" className={labelClass}>Apt, suite, etc. (optional)</label>
            <input
              id="address_line2"
              type="text"
              value={form.address_line2}
              onChange={(e) => updateField("address_line2", e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="city" className={labelClass}>City</label>
              <input
                id="city"
                type="text"
                required
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="state" className={labelClass}>State</label>
              <input
                id="state"
                type="text"
                required
                maxLength={2}
                value={form.state}
                onChange={(e) => updateField("state", e.target.value.toUpperCase())}
                className={inputClass}
                placeholder="TX"
              />
            </div>
            <div>
              <label htmlFor="zip" className={labelClass}>ZIP</label>
              <input
                id="zip"
                type="text"
                required
                maxLength={10}
                value={form.zip}
                onChange={(e) => updateField("zip", e.target.value)}
                className={inputClass}
                placeholder="78701"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Additional Info (optional)</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="year_built" className={labelClass}>Year built</label>
            <input
              id="year_built"
              type="number"
              min="1800"
              max="2100"
              value={form.year_built}
              onChange={(e) => updateField("year_built", e.target.value)}
              className={inputClass}
              placeholder="2005"
            />
          </div>
          <div>
            <label htmlFor="total_sqft" className={labelClass}>Total sq ft</label>
            <input
              id="total_sqft"
              type="number"
              min="0"
              value={form.total_sqft}
              onChange={(e) => updateField("total_sqft", e.target.value)}
              className={inputClass}
              placeholder="12000"
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
          {mode === "create" ? "Create Property" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
