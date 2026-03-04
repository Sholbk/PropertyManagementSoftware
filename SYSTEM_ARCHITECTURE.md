# PMPP — System Architecture
## Property Management Performance Platform

**Stack:** Next.js + Supabase + Netlify + GitHub
**Multi-tenant | RLS-enforced | AI-native | Performance-first**

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NETLIFY                                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Next.js App (SSR)                       │  │
│  │                                                           │  │
│  │  (auth)           (dashboard)          (resident-portal)  │  │
│  │  ├─ login         ├─ overview          ├─ submit-request  │  │
│  │  ├─ signup        ├─ properties/[id]   ├─ pay-rent        │  │
│  │  └─ invite        ├─ maintenance       └─ lease-info      │  │
│  │                   ├─ financials                            │  │
│  │                   ├─ leasing                               │  │
│  │                   ├─ vendors                               │  │
│  │                   └─ settings                              │  │
│  └────────────┬──────────────┬───────────────────────────────┘  │
│               │              │                                   │
└───────────────┼──────────────┼───────────────────────────────────┘
                │              │
        ┌───────▼───────┐ ┌───▼────────────────────────────────┐
        │  Supabase     │ │  Supabase Edge Functions            │
        │  Client SDK   │ │                                     │
        │               │ │  ai-triage      → classify + route  │
        │  .from()      │ │  ai-insights    → analyze KPIs      │
        │  .auth         │ │  ai-lease-advisor → renewal recs   │
        │  .realtime    │ │  compute-metrics → snapshot job     │
        │  .storage     │ │  webhook-stripe  → payment events   │
        │               │ │  send-notification → email/sms      │
        └───────┬───────┘ └──────────┬──────────────────────────┘
                │                    │
        ┌───────▼────────────────────▼──────────────────────────┐
        │                    SUPABASE                            │
        │                                                        │
        │  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐  │
        │  │ Postgres  │  │   Auth   │  │Storage │  │Realtime│  │
        │  │          │  │          │  │        │  │        │  │
        │  │ 14 tables│  │ Users +  │  │ Lease  │  │ Work   │  │
        │  │ 7 views  │  │ JWT +    │  │ docs,  │  │ order  │  │
        │  │ RLS on   │  │ Roles in │  │ photos,│  │ status,│  │
        │  │ every    │  │ metadata │  │ W9s,   │  │ new    │  │
        │  │ table    │  │ + RLS    │  │ reports│  │ alerts │  │
        │  └──────────┘  └──────────┘  └────────┘  └────────┘  │
        └────────────────────────────────────────────────────────┘
```

### How requests flow

1. **User opens app** → Netlify serves Next.js (SSR on Netlify Functions under the hood)
2. **Auth** → Supabase Auth issues JWT with `org_id` + `role` in `app_metadata`
3. **Data reads** → Supabase client SDK calls Postgres directly. RLS filters by `org_id` from JWT. No API server needed.
4. **Data writes** → Same. RLS + Postgres triggers handle validation and audit logging.
5. **Real-time** → Client subscribes to Supabase Realtime channels. Work order status changes, new notifications push instantly.
6. **AI operations** → Client calls Supabase Edge Functions. Functions read context from Postgres (using service role), call Claude API, write results back.
7. **Background jobs** → Edge Functions invoked on cron (via Supabase pg_cron) or webhook. Compute metric snapshots, send notifications.

### Why this works without a backend server

Supabase replaces the traditional API layer:
- **Postgres + RLS** = your authorization layer (no middleware needed)
- **Auth** = your identity layer (JWT issued automatically)
- **Edge Functions** = your serverless compute (Deno runtime, runs close to DB)
- **Realtime** = your WebSocket layer (no Socket.io server)
- **Storage** = your file layer (with RLS on buckets)

The Next.js app is purely a frontend that talks directly to Supabase. Netlify just hosts it.

---

## 2. Supabase Auth + Multi-Tenancy Strategy

### Tenant context lives in the JWT

When a user signs up or is invited, their `org_id` and `role` are stored in Supabase Auth's `raw_app_meta_data`:

```json
{
  "org_id": "uuid-of-their-organization",
  "role": "property_manager",
  "org_slug": "acme-properties"
}
```

**This metadata is embedded in every JWT.** RLS policies read it directly — no `SET LOCAL` needed, no middleware needed.

### Auth flows

**Sign up (org creation):**
1. User signs up via Supabase Auth
2. Database trigger `on_auth_user_created` fires
3. Trigger creates an `organizations` row + a `users` row with role `owner`
4. Updates `auth.users.raw_app_meta_data` with `{org_id, role: "owner"}`

**Invite team member:**
1. Owner calls Edge Function `invite-user`
2. Function uses Supabase Admin API: `auth.admin.inviteUserByEmail()` with metadata `{org_id, role}`
3. Invited user clicks link → account created with correct org_id baked in

**Role hierarchy:**
```
owner
  └── property_manager
        ├── leasing_agent
        ├── maintenance_tech
        └── accounting
vendor_user (external, scoped to assigned work orders only)
```

---

## 3. RLS Strategy

### Core principle

Every table has `org_id`. Every RLS policy extracts `org_id` from the JWT:

```sql
auth.jwt() -> 'app_metadata' ->> 'org_id'
```

This is evaluated per-row by Postgres. No application code can bypass it.

### Policy patterns

**Pattern 1 — Full org isolation (most tables):**
```sql
CREATE POLICY "org_isolation" ON properties
    FOR ALL
    USING (
        org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
    WITH CHECK (
        org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    );
```

**Pattern 2 — Role-restricted writes:**
```sql
-- Only owners and property_managers can create properties
CREATE POLICY "properties_insert" ON properties
    FOR INSERT
    WITH CHECK (
        org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'property_manager')
    );
```

**Pattern 3 — Row-scoped access (maintenance techs see only assigned work):**
```sql
CREATE POLICY "tech_sees_assigned" ON work_orders
    FOR SELECT
    USING (
        org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'property_manager')
            OR assigned_to = auth.uid()
        )
    );
```

**Pattern 4 — Vendor sees only their work orders:**
```sql
CREATE POLICY "vendor_work_orders" ON work_orders
    FOR SELECT
    USING (
        org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'vendor_user'
        AND vendor_id IN (
            SELECT id FROM vendors WHERE portal_user_id = auth.uid()
        )
    );
```

**Pattern 5 — Financial data restricted to owner + accounting:**
```sql
CREATE POLICY "financials_read" ON transactions
    FOR SELECT
    USING (
        org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'accounting', 'property_manager')
    );
```

### RLS per table summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| organizations | own org | — | owner only | — |
| users | own org | owner | owner + self | owner |
| properties | own org (tech: assigned only) | owner, PM | owner, PM | owner |
| units | own org | owner, PM | owner, PM | owner |
| tenants | own org | owner, PM, leasing | owner, PM, leasing | owner |
| leases | own org | owner, PM, leasing | owner, PM, leasing | owner |
| work_orders | own org (tech: assigned, vendor: assigned) | all roles | assigned tech, PM, owner | owner, PM |
| transactions | owner, PM, accounting | owner, accounting | owner, accounting | owner |
| vendors | own org | owner, PM | owner, PM | owner |
| metric_snapshots | own org | service_role only | service_role only | — |
| audit_log | owner only | service_role only | — | — |
| notifications | own (user_id = self) | service_role only | self (mark read) | — |

### Storage bucket RLS

```sql
-- Bucket: property-documents
-- Policy: org members can read their org's files
-- Path convention: {org_id}/{property_id}/{filename}
CREATE POLICY "org_read" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'property-documents'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
    );
```

---

## 4. Edge Function Architecture

Edge Functions handle everything that can't be done client-side: AI calls, background jobs, webhooks, and cross-table orchestration that would be clunky in RLS.

```
supabase/functions/
├── ai-triage/index.ts          # Classify + prioritize work orders
├── ai-insights/index.ts        # Analyze KPI trends, answer questions
├── ai-lease-advisor/index.ts   # Renewal recommendations
├── ai-vendor-match/index.ts    # Match work orders to best vendor
├── compute-metrics/index.ts    # Snapshot builder (runs on cron)
├── invite-user/index.ts        # Send team invitations
├── send-notification/index.ts  # Email/SMS dispatch
├── webhook-stripe/index.ts     # Payment event handler
├── _shared/                    # Shared utilities
│   ├── ai-provider.ts          # Claude API abstraction
│   ├── supabase-admin.ts       # Service role client
│   ├── cors.ts                 # CORS headers
│   └── types.ts                # Shared types
```

### AI Provider Abstraction

```typescript
// supabase/functions/_shared/ai-provider.ts
// Single interface — swap models without touching business logic

interface AIProvider {
  generate(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<{ text: string; tokensUsed: number }>;
}

// Default: Claude. Switch via PMPP_AI_PROVIDER env var.
export function getAIProvider(): AIProvider {
  const provider = Deno.env.get("PMPP_AI_PROVIDER") ?? "anthropic";
  switch (provider) {
    case "anthropic": return new ClaudeProvider();
    case "openai": return new OpenAIProvider();
    default: return new ClaudeProvider();
  }
}
```

### Example: ai-triage function

```typescript
// supabase/functions/ai-triage/index.ts
// Called when a new work order is created (via database webhook)

import { getAIProvider } from "../_shared/ai-provider.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  const { work_order_id } = await req.json();
  const supabase = createAdminClient();
  const ai = getAIProvider();

  // Fetch work order + property context
  const { data: wo } = await supabase
    .from("work_orders")
    .select("*, units(*), properties(*)")
    .eq("id", work_order_id)
    .single();

  // Fetch available vendors
  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .eq("org_id", wo.org_id)
    .contains("specialties", [wo.category]);

  // AI classification
  const result = await ai.generate({
    system: "You are a property maintenance expert...",
    prompt: `Classify this work order and recommend priority:
      Title: ${wo.title}
      Description: ${wo.description}
      Unit: ${wo.units?.unit_number}
      Property: ${wo.properties?.name}
      Available vendors: ${JSON.stringify(vendors?.map(v => ({
        name: v.company_name, rating: v.rating_avg, rate: v.hourly_rate
      })))}`,
    maxTokens: 500,
  });

  // Parse AI response and update work order
  const parsed = JSON.parse(result.text);
  await supabase.from("work_orders").update({
    ai_category_suggestion: parsed.category,
    ai_priority_score: parsed.priority_score,
    ai_vendor_suggestion_id: parsed.recommended_vendor_id,
    ai_estimated_cost: parsed.estimated_cost,
  }).eq("id", work_order_id);

  // Log AI activity
  await supabase.from("ai_activity_logs").insert({
    org_id: wo.org_id,
    action_type: "classification",
    domain: "maintenance",
    context_entity: "work_order",
    context_id: work_order_id,
    input_summary: wo.title,
    output_summary: `Priority: ${parsed.priority_score}, Vendor: ${parsed.recommended_vendor_id}`,
    model_provider: "anthropic",
    model_id: "claude-sonnet-4-6",
    tokens_input: result.tokensUsed,
  });

  return new Response(JSON.stringify({ ok: true }));
});
```

### Cron-triggered metric computation

```sql
-- In Supabase SQL Editor: schedule metric snapshots every hour
SELECT cron.schedule(
  'compute-hourly-metrics',
  '0 * * * *',  -- every hour
  $$
  SELECT net.http_post(
    'https://aabmwadzrmfwkaxnlluq.supabase.co/functions/v1/compute-metrics',
    '{}',
    'application/json',
    ARRAY[
      ('Authorization', 'Bearer ' || current_setting('supabase.service_role_key'))::http_header
    ]
  );
  $$
);
```

### Database webhooks → Edge Functions

Set up in Supabase Dashboard → Database → Webhooks:

| Trigger | Table | Event | Edge Function |
|---------|-------|-------|---------------|
| New work order | work_orders | INSERT | ai-triage |
| Lease expiring soon | leases | (cron check) | ai-lease-advisor |
| Payment received | transactions | INSERT | send-notification |

---

## 5. Realtime Subscriptions

### What gets real-time updates

| Channel | Table/Filter | Who subscribes | Purpose |
|---------|-------------|----------------|---------|
| `work_orders:{org_id}` | work_orders WHERE status changes | PM dashboard | Live status board |
| `notifications:{user_id}` | notifications WHERE user_id = me | Every user | Bell icon badge |
| `units:{property_id}` | units WHERE status changes | Property detail page | Vacancy updates |
| `transactions:{org_id}` | transactions INSERT | Accounting dashboard | New payments |

### Client-side pattern

```typescript
// In a React component
useEffect(() => {
  const channel = supabase
    .channel(`work_orders:${orgId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'work_orders',
      filter: `org_id=eq.${orgId}`,
    }, (payload) => {
      // Update local state — work order status changed
      updateWorkOrder(payload.new);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [orgId]);
```

### Realtime + RLS

Supabase Realtime respects RLS. A user only receives events for rows their RLS policy allows them to SELECT. No extra filtering needed.

---

## 6. Folder Structure

```
PropertyManagementSoftware/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # Netlify deploy on push to main
│       ├── preview.yml             # Netlify preview on PR
│       └── supabase-migrate.yml    # Run migrations on Supabase
│
├── src/                            # Next.js application
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── invite/[token]/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Sidebar + nav + auth guard
│   │   │   ├── page.tsx            # Portfolio overview (KPI cards)
│   │   │   ├── properties/
│   │   │   │   ├── page.tsx        # Property list
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    # Property detail
│   │   │   │       ├── units/page.tsx
│   │   │   │       ├── financials/page.tsx
│   │   │   │       └── maintenance/page.tsx
│   │   │   ├── maintenance/
│   │   │   │   ├── page.tsx        # Work order board (kanban)
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── leasing/
│   │   │   │   ├── page.tsx        # Active leases + pipeline
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── financials/
│   │   │   │   ├── page.tsx        # NOI dashboard
│   │   │   │   ├── transactions/page.tsx
│   │   │   │   └── reports/page.tsx
│   │   │   ├── vendors/page.tsx
│   │   │   ├── team/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (resident-portal)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── maintenance/page.tsx
│   │   │   └── payments/page.tsx
│   │   └── layout.tsx              # Root layout
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── dashboard/
│   │   │   ├── metric-card.tsx
│   │   │   ├── kpi-trend.tsx
│   │   │   ├── vacancy-gauge.tsx
│   │   │   └── noi-chart.tsx
│   │   ├── maintenance/
│   │   │   ├── work-order-board.tsx
│   │   │   ├── work-order-card.tsx
│   │   │   └── ai-triage-badge.tsx
│   │   ├── ai/
│   │   │   ├── ai-chat-panel.tsx
│   │   │   └── ai-suggestion.tsx
│   │   └── shared/
│   │       ├── data-table.tsx
│   │       ├── sidebar.tsx
│   │       └── notification-bell.tsx
│   │
│   ├── hooks/
│   │   ├── use-realtime.ts         # Generic realtime subscription
│   │   ├── use-org.ts              # Current org context
│   │   └── use-role.ts             # Role-based UI gating
│   │
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts           # Browser client
│   │       └── server.ts           # SSR client + admin client
│   │
│   └── types/
│       └── database.ts             # Generated from Supabase schema
│
├── supabase/
│   ├── config.toml                 # Supabase project config
│   ├── migrations/
│   │   ├── 001_schema.sql          # Tables, types, indexes
│   │   ├── 002_kpi_views.sql       # KPI calculation views
│   │   ├── 003_rls_policies.sql    # All RLS policies
│   │   ├── 004_triggers.sql        # Audit, updated_at, lease history
│   │   ├── 005_auth_hooks.sql      # on_auth_user_created trigger
│   │   └── 006_storage_buckets.sql # Buckets + storage policies
│   ├── functions/
│   │   ├── ai-triage/index.ts
│   │   ├── ai-insights/index.ts
│   │   ├── ai-lease-advisor/index.ts
│   │   ├── ai-vendor-match/index.ts
│   │   ├── compute-metrics/index.ts
│   │   ├── invite-user/index.ts
│   │   ├── send-notification/index.ts
│   │   ├── webhook-stripe/index.ts
│   │   └── _shared/
│   │       ├── ai-provider.ts
│   │       ├── supabase-admin.ts
│   │       ├── cors.ts
│   │       └── types.ts
│   └── seed.sql                    # Dev seed data
│
├── netlify.toml                    # Build config
├── .env.local.example              # Env template
├── package.json
└── tsconfig.json
```

---

## 7. CI/CD Flow

```
Developer pushes to feature branch
         │
         ▼
┌─────────────────────────────────┐
│  GitHub Actions: preview.yml    │
│                                 │
│  1. npm ci                      │
│  2. npm run build               │
│  3. Netlify deploy --preview    │◄──── Preview URL on PR comment
│  4. Run Supabase migrations     │
│     against preview branch DB   │
└─────────────────────────────────┘
         │
    PR merged to main
         │
         ▼
┌─────────────────────────────────┐
│  GitHub Actions: deploy.yml     │
│                                 │
│  1. npm ci                      │
│  2. npm run build               │
│  3. Netlify deploy --prod       │
│  4. supabase db push (prod)     │
│  5. supabase functions deploy   │
└─────────────────────────────────┘
```

### deploy.yml

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build

      # Supabase migrations
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase functions deploy
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      # Netlify deploy
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=.next
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## 8. Environment Variable Strategy

### Three environments, three sources

| Variable | Where stored | Who reads it |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Netlify env vars | Next.js (client + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Netlify env vars | Next.js (client + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify env vars (server only) | Next.js SSR only |
| `ANTHROPIC_API_KEY` | Supabase secrets (vault) | Edge Functions only |
| `STRIPE_SECRET_KEY` | Supabase secrets (vault) | Edge Functions only |
| `STRIPE_WEBHOOK_SECRET` | Supabase secrets (vault) | Edge Functions only |
| `RESEND_API_KEY` | Supabase secrets (vault) | Edge Functions only |
| `PMPP_AI_PROVIDER` | Supabase secrets (vault) | Edge Functions only |

### Separation principle

- **`NEXT_PUBLIC_*`** — safe to expose to browser. Only the anon key (rate-limited, RLS-enforced).
- **Netlify server env** — `SUPABASE_SERVICE_ROLE_KEY` is available in SSR but never shipped to client.
- **Supabase secrets** — AI keys, payment keys, email keys live in Supabase Vault. Only Edge Functions can read them. Never in Netlify, never in the browser.

### Setting Supabase secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx
supabase secrets set RESEND_API_KEY=re_xxxxx
```

### GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | CLI auth for migrations + function deploys |
| `SUPABASE_PROJECT_ID` | `aabmwadzrmfwkaxnlluq` |
| `NETLIFY_AUTH_TOKEN` | CLI auth for deploys |
| `NETLIFY_SITE_ID` | Your Netlify site ID |

### Local development

```bash
# .env.local (git-ignored)
NEXT_PUBLIC_SUPABASE_URL=https://aabmwadzrmfwkaxnlluq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Edge Functions in local dev read secrets from `.env` in `supabase/functions/`:
```bash
# supabase/functions/.env (git-ignored)
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

---

## Performance-First Design Principles

This platform measures **outcomes, not activity**.

### KPIs that drive the dashboard (not hidden in reports)

| KPI | Source | Update frequency |
|-----|--------|-----------------|
| **NOI** (Net Operating Income) | `v_noi_by_property` → `metric_snapshots` | Hourly snapshot |
| **Vacancy Rate** | `v_vacancy_by_property` → Realtime on unit status change | Real-time |
| **Rent Collection Rate** | `v_rent_collection` → `metric_snapshots` | Hourly |
| **Avg Work Order Completion Time** | `v_maintenance_cost_per_unit` → `metric_snapshots` | Hourly |
| **Tenant Retention Rate** | `v_tenant_retention` → `metric_snapshots` | Daily |
| **Rent Growth %** | `v_rent_growth` → `metric_snapshots` | On lease renewal |
| **Maintenance Cost / Unit** | `v_maintenance_cost_per_unit` → `metric_snapshots` | Hourly |
| **Delinquency Rate** | `v_rent_collection` → `metric_snapshots` | Hourly |

### AI doesn't just answer questions — it drives outcomes

| AI Agent | Trigger | Outcome it improves |
|----------|---------|---------------------|
| **Maintenance Triage** | New work order created | Reduces avg completion time by auto-routing |
| **Lease Renewal Advisor** | 90 days before expiry | Increases retention rate with data-backed offers |
| **Financial Insights** | User asks "why did NOI drop?" | Surfaces root cause, not just the number |
| **Vendor Matching** | Work order needs external vendor | Reduces maintenance cost by matching best vendor |
