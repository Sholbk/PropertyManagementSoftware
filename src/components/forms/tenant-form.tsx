"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

interface TenantFormData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  income_annual: string;
  employer: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
}

interface TenantFormProps {
  initialData?: Partial<TenantFormData>;
  mode: "create" | "edit";
}

export function TenantForm({ initialData, mode }: TenantFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<TenantFormData>({
    first_name: initialData?.first_name ?? "",
    last_name: initialData?.last_name ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    date_of_birth: initialData?.date_of_birth ?? "",
    income_annual: initialData?.income_annual ?? "",
    employer: initialData?.employer ?? "",
    emergency_contact_name: initialData?.emergency_contact_name ?? "",
    emergency_contact_phone: initialData?.emergency_contact_phone ?? "",
    notes: initialData?.notes ?? "",
  });

  function updateField(field: keyof TenantFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      ...form,
      income_annual: form.income_annual ? Number(form.income_annual) : null,
      date_of_birth: form.date_of_birth || null,
      emergency_contact: form.emergency_contact_name
        ? { name: form.emergency_contact_name, phone: form.emergency_contact_phone }
        : null,
      ...(mode === "edit" && initialData?.id ? { id: initialData.id } : {}),
    };

    try {
      const res = await fetch("/api/tenants", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save tenant");
        setLoading(false);
        return;
      }

      const data = await res.json();
      router.push(`/tenants/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Personal Information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className={labelClass}>First name</label>
              <input id="first_name" type="text" required value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="last_name" className={labelClass}>Last name</label>
              <input id="last_name" type="text" required value={form.last_name} onChange={(e) => updateField("last_name", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>Phone</label>
              <input id="phone" type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputClass} placeholder="512-555-0100" />
            </div>
          </div>
          <div>
            <label htmlFor="date_of_birth" className={labelClass}>Date of birth</label>
            <input id="date_of_birth" type="date" value={form.date_of_birth} onChange={(e) => updateField("date_of_birth", e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Employment & Income</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="employer" className={labelClass}>Employer</label>
            <input id="employer" type="text" value={form.employer} onChange={(e) => updateField("employer", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="income_annual" className={labelClass}>Annual income ($)</label>
            <input id="income_annual" type="number" min="0" value={form.income_annual} onChange={(e) => updateField("income_annual", e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Emergency Contact</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="ec_name" className={labelClass}>Contact name</label>
            <input id="ec_name" type="text" value={form.emergency_contact_name} onChange={(e) => updateField("emergency_contact_name", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="ec_phone" className={labelClass}>Contact phone</label>
            <input id="ec_phone" type="tel" value={form.emergency_contact_phone} onChange={(e) => updateField("emergency_contact_phone", e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Notes</h2>
        <textarea id="notes" rows={3} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} className={inputClass} placeholder="Additional notes..." />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={loading}>{mode === "create" ? "Add Tenant" : "Save Changes"}</Button>
      </div>
    </form>
  );
}
