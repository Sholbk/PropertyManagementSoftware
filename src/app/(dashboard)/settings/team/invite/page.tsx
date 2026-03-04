"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { value: "property_manager", label: "Property Manager" },
  { value: "maintenance_tech", label: "Maintenance Tech" },
  { value: "leasing_agent", label: "Leasing Agent" },
  { value: "accounting", label: "Accounting" },
  { value: "vendor_user", label: "Vendor User" },
];

const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

export default function InviteTeamMemberPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("property_manager");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const orgId = user?.app_metadata?.active_org_id;

    if (!orgId) {
      setError("No active organization");
      setLoading(false);
      return;
    }

    try {
      // Call the invite-user Edge Function
      const { data, error: fnError } = await supabase.functions.invoke("invite-user", {
        body: { email, role, org_id: orgId },
      });

      if (fnError) {
        setError(fnError.message);
        setLoading(false);
        return;
      }

      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError("Failed to send invitation.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-800">Invitation Sent</h2>
          <p className="mt-2 text-sm text-green-700">An invitation has been sent to {email}.</p>
          <div className="mt-4 flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => { setSuccess(false); setEmail(""); }}>Invite Another</Button>
            <Button onClick={() => router.push("/settings")}>Back to Settings</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <h1 className="text-2xl font-bold text-gray-900">Invite Team Member</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="invite_email" className={labelClass}>Email address</label>
          <input id="invite_email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="teammate@company.com" />
        </div>

        <div>
          <label htmlFor="invite_role" className={labelClass}>Role</label>
          <select id="invite_role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            {role === "property_manager" && "Full access to properties, tenants, leases, and maintenance."}
            {role === "maintenance_tech" && "Can view and update assigned work orders only."}
            {role === "leasing_agent" && "Can manage tenants and leases."}
            {role === "accounting" && "Read-only access to financial data."}
            {role === "vendor_user" && "Can view assigned work orders."}
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={loading}>Send Invitation</Button>
        </div>
      </form>
    </div>
  );
}
