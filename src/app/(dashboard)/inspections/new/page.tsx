import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { InspectionForm } from "@/components/forms/inspection-form";

export const metadata = { title: "Schedule Inspection | PMPP" };

export default async function NewInspectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) redirect("/onboarding");

  const [{ data: properties }, { data: units }, { data: members }] = await Promise.all([
    supabase.from("properties").select("id, name").eq("organization_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("units").select("id, unit_number, properties(name)").eq("organization_id", orgId).is("deleted_at", null).order("unit_number"),
    supabase.from("memberships").select("user_id, users(full_name)").eq("organization_id", orgId).is("deleted_at", null),
  ]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Inspections", href: "/inspections" }, { label: "Schedule Inspection" }]} />
      <h1 className="text-2xl font-bold text-gray-900">Schedule Inspection</h1>
      <InspectionForm
        properties={(properties ?? []).map((p) => ({ value: p.id, label: p.name }))}
        units={(units ?? []).map((u) => {
          const prop = u.properties as unknown as { name: string } | null;
          return { value: u.id, label: `${prop?.name ?? ""} — ${u.unit_number}` };
        })}
        teamMembers={(members ?? []).map((m) => {
          const u = m.users as unknown as { full_name: string } | null;
          return { value: m.user_id, label: u?.full_name ?? "Unknown" };
        })}
      />
    </div>
  );
}
