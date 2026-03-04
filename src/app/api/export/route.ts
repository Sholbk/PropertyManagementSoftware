import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = user.app_metadata?.active_org_id;
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity");

  if (!entity) return NextResponse.json({ error: "Entity type is required" }, { status: 400 });

  let csvContent = "";

  switch (entity) {
    case "properties": {
      const { data } = await supabase
        .from("properties")
        .select("name, property_type, address_line1, city, state, zip, year_built, total_sqft")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("name");
      csvContent = "Name,Type,Address,City,State,ZIP,Year Built,Sq Ft\n";
      for (const p of data ?? []) {
        csvContent += `"${p.name}","${p.property_type}","${p.address_line1}","${p.city}","${p.state}","${p.zip}",${p.year_built ?? ""},${p.total_sqft ?? ""}\n`;
      }
      break;
    }
    case "tenants": {
      const { data } = await supabase
        .from("tenants")
        .select("first_name, last_name, email, phone, employer, income_annual")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("last_name");
      csvContent = "First Name,Last Name,Email,Phone,Employer,Annual Income\n";
      for (const t of data ?? []) {
        csvContent += `"${t.first_name}","${t.last_name}","${t.email ?? ""}","${t.phone ?? ""}","${t.employer ?? ""}",${t.income_annual ?? ""}\n`;
      }
      break;
    }
    case "leases": {
      const { data } = await supabase
        .from("leases")
        .select("status, start_date, end_date, monthly_rent, security_deposit, tenants(first_name, last_name), units(unit_number), properties(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("start_date", { ascending: false });
      csvContent = "Property,Unit,Tenant,Status,Start Date,End Date,Monthly Rent,Security Deposit\n";
      for (const l of data ?? []) {
        const tenant = l.tenants as unknown as { first_name: string; last_name: string } | null;
        const unit = l.units as unknown as { unit_number: string } | null;
        const property = l.properties as unknown as { name: string } | null;
        csvContent += `"${property?.name ?? ""}","${unit?.unit_number ?? ""}","${tenant ? `${tenant.first_name} ${tenant.last_name}` : ""}","${l.status}","${l.start_date}","${l.end_date ?? ""}",${l.monthly_rent},${l.security_deposit ?? ""}\n`;
      }
      break;
    }
    case "transactions": {
      const { data } = await supabase
        .from("financial_transactions")
        .select("type, amount, status, transaction_date, description, properties(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .limit(1000);
      csvContent = "Date,Type,Description,Amount,Status,Property\n";
      for (const t of data ?? []) {
        const property = t.properties as unknown as { name: string } | null;
        csvContent += `"${t.transaction_date}","${t.type}","${t.description ?? ""}",${t.amount},"${t.status}","${property?.name ?? ""}"\n`;
      }
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown entity type" }, { status: 400 });
  }

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${entity}-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
