import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Settings | PMPP" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return <EmptyState title="No organization selected" />;

  // Fetch org details
  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  // Fetch team members
  const { data: members } = await supabase
    .from("memberships")
    .select("id, role, status, users(full_name, email)")
    .eq("organization_id", orgId)
    .order("role");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Organization Info */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Organization</h3>
        {org ? (
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium">{org.name}</p>
            </div>
            <div>
              <p className="text-gray-500">Plan</p>
              <p className="font-medium capitalize">{org.plan}</p>
            </div>
            <div>
              <p className="text-gray-500">Timezone</p>
              <p className="font-medium">{org.timezone}</p>
            </div>
            <div>
              <p className="text-gray-500">Subscription</p>
              <Badge variant={org.subscription_status === "active" ? "success" : "warning"}>
                {org.subscription_status}
              </Badge>
            </div>
            <div>
              <p className="text-gray-500">Slug</p>
              <p className="font-medium">{org.slug}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Organization not found</p>
        )}
      </Card>

      {/* Team Members */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Team Members ({members?.length ?? 0})
        </h3>
        {members && members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Role</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.map((m) => {
                  const u = m.users as unknown as { full_name: string; email: string } | null;
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">{u?.full_name ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">{u?.email ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge variant="info">{m.role.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge variant={m.status === "active" ? "success" : m.status === "invited" ? "warning" : "danger"}>
                          {m.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No team members found</p>
        )}
      </Card>
    </div>
  );
}
