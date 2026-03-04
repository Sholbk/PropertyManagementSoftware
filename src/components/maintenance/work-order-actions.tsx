"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface WorkOrderActionsProps {
  requestId: string;
  requestTitle: string;
  propertyId: string;
  unitId: string | null;
  category: string;
  priority: string;
  vendors: { id: string; label: string }[];
}

export function WorkOrderActions({ requestId, requestTitle, propertyId, unitId, category, priority, vendors }: WorkOrderActionsProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");

  const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  async function handleCreate() {
    setLoading(true);

    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenance_request_id: requestId,
          property_id: propertyId,
          unit_id: unitId,
          title: `WO: ${requestTitle}`,
          category,
          priority,
          vendor_id: vendorId || null,
          scheduled_date: scheduledDate || null,
        }),
      });

      if (res.ok) {
        router.refresh();
        setShowForm(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!showForm) {
    return (
      <Button size="sm" onClick={() => setShowForm(true)}>
        Create Work Order
      </Button>
    );
  }

  return (
    <div className="w-full rounded-md border border-blue-200 bg-blue-50 p-4 mt-2">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Create Work Order</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Assign Vendor</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Scheduled Date</label>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button size="sm" loading={loading} onClick={handleCreate}>Create</Button>
        </div>
      </div>
    </div>
  );
}
