"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: "property" | "tenant" | "lease" | "maintenance";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const supabase = createClient();
    const pattern = `%${q}%`;
    const items: SearchResult[] = [];

    const [{ data: properties }, { data: tenants }, { data: requests }] = await Promise.all([
      supabase.from("properties").select("id, name, address_line1, city, state").ilike("name", pattern).is("deleted_at", null).limit(5),
      supabase.from("tenants").select("id, first_name, last_name, email").or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`).is("deleted_at", null).limit(5),
      supabase.from("maintenance_requests").select("id, title, status").ilike("title", pattern).is("deleted_at", null).limit(5),
    ]);

    for (const p of properties ?? []) {
      items.push({ type: "property", id: p.id, title: p.name, subtitle: `${p.city}, ${p.state}`, href: `/properties/${p.id}` });
    }
    for (const t of tenants ?? []) {
      items.push({ type: "tenant", id: t.id, title: `${t.first_name} ${t.last_name}`, subtitle: t.email ?? "", href: `/tenants/${t.id}` });
    }
    for (const r of requests ?? []) {
      items.push({ type: "maintenance", id: r.id, title: r.title, subtitle: r.status, href: `/maintenance/${r.id}` });
    }

    setResults(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const typeIcon: Record<string, string> = {
    property: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16",
    tenant: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    maintenance: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0",
    lease: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-400 hover:border-gray-400"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400 sm:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b p-3">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search properties, tenants, requests..."
              className="w-full text-sm outline-none"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-3 py-4 text-center text-sm text-gray-400">Searching...</p>}
            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-gray-400">No results found</p>
            )}
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => { router.push(r.href); setOpen(false); setQuery(""); }}
              >
                <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={typeIcon[r.type] ?? typeIcon.property} />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{r.title}</p>
                  <p className="truncate text-xs text-gray-500">{r.subtitle}</p>
                </div>
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs capitalize text-gray-500">{r.type}</span>
              </button>
            ))}
            {!loading && query.length < 2 && (
              <p className="px-3 py-4 text-center text-sm text-gray-400">Type at least 2 characters to search</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
