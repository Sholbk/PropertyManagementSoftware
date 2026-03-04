"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

interface LeaseFormData {
  id?: string;
  property_id: string;
  unit_id: string;
  tenant_id: string;
  lease_type: string;
  status: string;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  security_deposit: string;
  pet_deposit: string;
  rent_due_day: string;
  late_fee_amount: string;
  late_fee_grace_days: string;
  escalation_pct: string;
  move_in_date: string;
}

interface SelectOption {
  id: string;
  label: string;
}

interface LeaseFormProps {
  initialData?: Partial<LeaseFormData>;
  mode: "create" | "edit";
  properties: SelectOption[];
  units: SelectOption[];
  tenants: SelectOption[];
}

export function LeaseForm({ initialData, mode, properties, units, tenants }: LeaseFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<LeaseFormData>({
    property_id: initialData?.property_id ?? "",
    unit_id: initialData?.unit_id ?? "",
    tenant_id: initialData?.tenant_id ?? "",
    lease_type: initialData?.lease_type ?? "fixed",
    status: initialData?.status ?? "draft",
    start_date: initialData?.start_date ?? "",
    end_date: initialData?.end_date ?? "",
    monthly_rent: initialData?.monthly_rent ?? "",
    security_deposit: initialData?.security_deposit ?? "",
    pet_deposit: initialData?.pet_deposit ?? "",
    rent_due_day: initialData?.rent_due_day ?? "1",
    late_fee_amount: initialData?.late_fee_amount ?? "",
    late_fee_grace_days: initialData?.late_fee_grace_days ?? "5",
    escalation_pct: initialData?.escalation_pct ?? "",
    move_in_date: initialData?.move_in_date ?? "",
  });

  function updateField(field: keyof LeaseFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      ...form,
      monthly_rent: Number(form.monthly_rent),
      security_deposit: form.security_deposit ? Number(form.security_deposit) : null,
      pet_deposit: form.pet_deposit ? Number(form.pet_deposit) : null,
      rent_due_day: Number(form.rent_due_day),
      late_fee_amount: form.late_fee_amount ? Number(form.late_fee_amount) : null,
      late_fee_grace_days: form.late_fee_grace_days ? Number(form.late_fee_grace_days) : null,
      escalation_pct: form.escalation_pct ? Number(form.escalation_pct) : null,
      end_date: form.end_date || null,
      move_in_date: form.move_in_date || null,
      ...(mode === "edit" && initialData?.id ? { id: initialData.id } : {}),
    };

    try {
      const res = await fetch("/api/leases", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save lease");
        setLoading(false);
        return;
      }

      const data = await res.json();
      router.push(`/leasing/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Lease Assignment</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="property_id" className={labelClass}>Property</label>
              <select id="property_id" required value={form.property_id} onChange={(e) => updateField("property_id", e.target.value)} className={inputClass}>
                <option value="">Select property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="unit_id" className={labelClass}>Unit</label>
              <select id="unit_id" required value={form.unit_id} onChange={(e) => updateField("unit_id", e.target.value)} className={inputClass}>
                <option value="">Select unit</option>
                {units.filter((u) => !form.property_id || u.id).map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tenant_id" className={labelClass}>Tenant</label>
              <select id="tenant_id" required value={form.tenant_id} onChange={(e) => updateField("tenant_id", e.target.value)} className={inputClass}>
                <option value="">Select tenant</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Lease Terms</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lease_type" className={labelClass}>Lease type</label>
              <select id="lease_type" value={form.lease_type} onChange={(e) => updateField("lease_type", e.target.value)} className={inputClass}>
                <option value="fixed">Fixed Term</option>
                <option value="month_to_month">Month-to-Month</option>
              </select>
            </div>
            <div>
              <label htmlFor="status" className={labelClass}>Status</label>
              <select id="status" value={form.status} onChange={(e) => updateField("status", e.target.value)} className={inputClass}>
                <option value="draft">Draft</option>
                <option value="pending_signature">Pending Signature</option>
                <option value="active">Active</option>
                <option value="month_to_month">Month-to-Month</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="start_date" className={labelClass}>Start date</label>
              <input id="start_date" type="date" required value={form.start_date} onChange={(e) => updateField("start_date", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="end_date" className={labelClass}>End date</label>
              <input id="end_date" type="date" value={form.end_date} onChange={(e) => updateField("end_date", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="move_in_date" className={labelClass}>Move-in date</label>
              <input id="move_in_date" type="date" value={form.move_in_date} onChange={(e) => updateField("move_in_date", e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Financial Terms</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="monthly_rent" className={labelClass}>Monthly rent ($)</label>
              <input id="monthly_rent" type="number" required min="0" step="0.01" value={form.monthly_rent} onChange={(e) => updateField("monthly_rent", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="security_deposit" className={labelClass}>Security deposit ($)</label>
              <input id="security_deposit" type="number" min="0" step="0.01" value={form.security_deposit} onChange={(e) => updateField("security_deposit", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pet_deposit" className={labelClass}>Pet deposit ($)</label>
              <input id="pet_deposit" type="number" min="0" step="0.01" value={form.pet_deposit} onChange={(e) => updateField("pet_deposit", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label htmlFor="rent_due_day" className={labelClass}>Rent due day</label>
              <input id="rent_due_day" type="number" min="1" max="28" value={form.rent_due_day} onChange={(e) => updateField("rent_due_day", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="late_fee_amount" className={labelClass}>Late fee ($)</label>
              <input id="late_fee_amount" type="number" min="0" step="0.01" value={form.late_fee_amount} onChange={(e) => updateField("late_fee_amount", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="late_fee_grace_days" className={labelClass}>Grace days</label>
              <input id="late_fee_grace_days" type="number" min="0" value={form.late_fee_grace_days} onChange={(e) => updateField("late_fee_grace_days", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="escalation_pct" className={labelClass}>Escalation %</label>
              <input id="escalation_pct" type="number" min="0" max="100" step="0.1" value={form.escalation_pct} onChange={(e) => updateField("escalation_pct", e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={loading}>{mode === "create" ? "Create Lease" : "Save Changes"}</Button>
      </div>
    </form>
  );
}
