"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const SPECIALTIES = ["plumbing", "electrical", "hvac", "appliance", "structural", "pest", "landscaping", "painting", "roofing", "general"];

const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

interface VendorFormData {
  id?: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  specialties: string[];
  hourly_rate: string;
  license_number: string;
  insurance_provider: string;
  insurance_expiry: string;
  w9_on_file: boolean;
  is_preferred: boolean;
  notes: string;
}

interface VendorFormProps {
  initialData?: Partial<VendorFormData>;
  mode: "create" | "edit";
}

export function VendorForm({ initialData, mode }: VendorFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<VendorFormData>({
    company_name: initialData?.company_name ?? "",
    contact_name: initialData?.contact_name ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    address: initialData?.address ?? "",
    specialties: initialData?.specialties ?? [],
    hourly_rate: initialData?.hourly_rate ?? "",
    license_number: initialData?.license_number ?? "",
    insurance_provider: initialData?.insurance_provider ?? "",
    insurance_expiry: initialData?.insurance_expiry ?? "",
    w9_on_file: initialData?.w9_on_file ?? false,
    is_preferred: initialData?.is_preferred ?? false,
    notes: initialData?.notes ?? "",
  });

  function updateField(field: keyof VendorFormData, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSpecialty(spec: string) {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(spec)
        ? prev.specialties.filter((s) => s !== spec)
        : [...prev.specialties, spec],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      ...form,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      insurance_expiry: form.insurance_expiry || null,
      ...(mode === "edit" && initialData?.id ? { id: initialData.id } : {}),
    };

    try {
      const res = await fetch("/api/vendors", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save vendor");
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
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Company Info</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="company_name" className={labelClass}>Company name</label>
            <input id="company_name" type="text" required value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact_name" className={labelClass}>Contact name</label>
              <input id="contact_name" type="text" value={form.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="hourly_rate" className={labelClass}>Hourly rate ($)</label>
              <input id="hourly_rate" type="number" min="0" step="0.01" value={form.hourly_rate} onChange={(e) => updateField("hourly_rate", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="v_email" className={labelClass}>Email</label>
              <input id="v_email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="v_phone" className={labelClass}>Phone</label>
              <input id="v_phone" type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="v_address" className={labelClass}>Address</label>
            <input id="v_address" type="text" value={form.address} onChange={(e) => updateField("address", e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Specialties</h2>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((spec) => (
            <button
              key={spec}
              type="button"
              onClick={() => toggleSpecialty(spec)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                form.specialties.includes(spec)
                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                  : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
              }`}
            >
              {spec}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Compliance</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="license_number" className={labelClass}>License number</label>
              <input id="license_number" type="text" value={form.license_number} onChange={(e) => updateField("license_number", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="insurance_provider" className={labelClass}>Insurance provider</label>
              <input id="insurance_provider" type="text" value={form.insurance_provider} onChange={(e) => updateField("insurance_provider", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="insurance_expiry" className={labelClass}>Insurance expiry</label>
            <input id="insurance_expiry" type="date" value={form.insurance_expiry} onChange={(e) => updateField("insurance_expiry", e.target.value)} className={inputClass} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.w9_on_file} onChange={(e) => updateField("w9_on_file", e.target.checked)} className="rounded border-gray-300" />
              W-9 on file
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_preferred} onChange={(e) => updateField("is_preferred", e.target.checked)} className="rounded border-gray-300" />
              Preferred vendor
            </label>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={loading}>{mode === "create" ? "Add Vendor" : "Save Changes"}</Button>
      </div>
    </form>
  );
}
