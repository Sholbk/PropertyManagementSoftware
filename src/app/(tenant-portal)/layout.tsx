import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TenantPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/portal" className="text-xl font-bold text-gray-900">PMPP Tenant Portal</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/portal" className="text-gray-600 hover:text-gray-900">Home</Link>
            <Link href="/portal/maintenance" className="text-gray-600 hover:text-gray-900">Maintenance</Link>
            <Link href="/portal/payments" className="text-gray-600 hover:text-gray-900">Payments</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
