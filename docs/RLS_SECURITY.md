# RLS Security Model — PMPP

## How It Works

Every request to Supabase carries a JWT. The JWT contains `app_metadata.active_org_id` — the organization the user is currently operating in. Three helper functions extract context from this JWT:

```sql
auth_org_id()          -- returns the active organization UUID from JWT
auth_org_role()        -- looks up user's role in memberships table
auth_has_role(TEXT[])   -- checks if user has any of the given roles
```

Every table has `organization_id`. Every RLS policy checks:
1. Does this row belong to the user's active org?
2. Does the user's role permit this operation?

**No application code can bypass this.** Even if the frontend has a bug, Postgres enforces isolation at the row level.

---

## Role-Based Access Matrix

### Legend
- **R** = Read (SELECT)
- **C** = Create (INSERT)
- **U** = Update
- **D** = Delete
- **—** = No access
- **self** = Own records only
- **assigned** = Only rows assigned to them

| Table | Owner | Manager | Maintenance | Leasing | Accounting | Vendor | Resident |
|-------|-------|---------|-------------|---------|------------|--------|----------|
| **organizations** | R U | R | R | R | R | R | R |
| **users** | R | R | R | R | R | R | R |
| **memberships** | R C U D | R C | R | R | R | R | R |
| **properties** | R C U D | R C U | R | R | R | — | — |
| **units** | R C U | R C U | R | R | R | — | — |
| **tenants** | R C U | R C U | — | R C U | R | — | R (self) |
| **leases** | R C U | R C U | — | R C U | R | — | — |
| **lease_audit_log** | R | R | — | — | — | — | — |
| **maintenance_requests** | R C U | R C U | R U | R | — | — | R C (self) |
| **work_orders** | R C U | R C U | R U (assigned) | — | R | R (assigned) | — |
| **work_order_events** | R C | R C | R C | R C | R C | R C | R C |
| **financial_transactions** | R C U | R | — | — | R C U | — | — |
| **vendors** | R C U | R C U | R | R | R | R (self) | — |
| **performance_snapshots** | R | R | R | R | R | R | R |
| **ai_action_logs** | R | R | — | — | — | — | — |
| **notifications** | R U (self) | R U (self) | R U (self) | R U (self) | R U (self) | R U (self) | R U (self) |

### Key restrictions:
- **Financial transactions**: Only owner + accounting can create/edit. Managers can read. Everyone else blocked.
- **Work orders**: Maintenance techs only see work orders assigned to them via `assigned_to = auth.uid()`.
- **Vendors**: Vendor users only see work orders where `vendor_id` matches their vendor record.
- **Memberships**: Only owners can modify team membership. Owners cannot delete themselves.
- **Lease audit log**: Read-only for owner + manager. Written by database trigger (SECURITY DEFINER), not by users.
- **Performance snapshots**: Read-only for all. Written by Edge Function using service_role key.
- **Notifications**: Users can only see and mark-read their own notifications.

---

## Security Edge Cases

### 1. Cross-tenant data leak
**Risk:** User manipulates `organization_id` in an INSERT to write data into another org.
**Protection:** `WITH CHECK (organization_id = auth_org_id())` on every INSERT policy. Postgres rejects the row if the org_id doesn't match the JWT.

### 2. Org switching without re-authentication
**Risk:** User belongs to Org A and Org B. They switch to Org B in the UI — do they see Org A data during the transition?
**Protection:** `active_org_id` is stored in JWT `app_metadata`. When the user switches orgs, the frontend calls `supabase.auth.updateUser({ data: { active_org_id: newOrgId } })`. The JWT is refreshed, and all subsequent queries use the new org context. Old cached data is client-side only — the database never serves cross-org rows.

### 3. Suspended membership
**Risk:** A user is suspended from an org but still has a valid JWT with that org's ID.
**Protection:** `auth_has_role()` checks `status = 'active'` in the memberships table. Suspended users pass the `auth_org_id()` check but fail every role check, so they can't read or write anything.

### 4. Self-deletion by owner
**Risk:** Owner removes their own membership, locking everyone out of the org.
**Protection:** `user_id != auth.uid()` on the memberships DELETE policy. Owners cannot delete their own membership.

### 5. Role escalation
**Risk:** A leasing agent changes their own membership role to 'owner'.
**Protection:** Only `auth_has_role(ARRAY['owner'])` can UPDATE memberships. The leasing agent's role doesn't match, so Postgres rejects the update.

### 6. Vendor accessing other vendors' work orders
**Risk:** Vendor A sees Vendor B's work orders.
**Protection:** Vendor SELECT policy checks `vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())`. Each vendor user can only see work orders linked to their own vendor record.

### 7. Maintenance tech seeing all work orders
**Risk:** Tech browses all open work orders to cherry-pick easy ones.
**Protection:** Tech SELECT policy requires `assigned_to = auth.uid()`. They only see work orders explicitly assigned to them by a manager.

### 8. Soft-deleted rows still visible
**Risk:** Deleted properties, tenants, etc. appear in queries.
**Protection:** Every SELECT policy includes `deleted_at IS NULL`. Soft-deleted rows are invisible to all users. Only service_role (Edge Functions) can query them if needed for reporting.

### 9. Service role key exposure
**Risk:** `SUPABASE_SERVICE_ROLE_KEY` leaks to the browser, bypassing all RLS.
**Protection:**
- Service role key is ONLY in Supabase secrets (Edge Functions) and Netlify server-side env vars.
- It's NEVER in `NEXT_PUBLIC_*` variables.
- The browser client uses only the anon key, which is rate-limited and RLS-enforced.
- The `createAdminClient()` function exists only in `server.ts` (SSR) and Edge Functions.

### 10. JWT expiration and stale org context
**Risk:** User is removed from org, but their JWT hasn't expired yet (still has old active_org_id).
**Protection:** `auth_has_role()` does a live lookup against the memberships table on every query. If the membership is deleted or suspended, the function returns false even with a valid JWT. The JWT just provides the org_id — authorization is always checked against the database.

---

## Testing Strategy

### 1. Unit tests: SQL-level policy verification

Run these in the Supabase SQL Editor to verify each policy. Use `set_config` to simulate different users.

```sql
-- ============================================================
-- TEST SETUP: Create test org, users, and memberships
-- Run with service_role (bypasses RLS)
-- ============================================================

-- Create test org
INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Org', 'test-org');

-- Create second org (for cross-tenant tests)
INSERT INTO organizations (id, name, slug)
VALUES ('22222222-2222-2222-2222-222222222222', 'Other Org', 'other-org');

-- Create test users (normally done by auth trigger)
INSERT INTO users (id, email, full_name) VALUES
('aaaa0000-0000-0000-0000-000000000001', 'owner@test.com', 'Test Owner'),
('aaaa0000-0000-0000-0000-000000000002', 'manager@test.com', 'Test Manager'),
('aaaa0000-0000-0000-0000-000000000003', 'tech@test.com', 'Test Tech'),
('aaaa0000-0000-0000-0000-000000000004', 'leasing@test.com', 'Test Leasing'),
('aaaa0000-0000-0000-0000-000000000005', 'accounting@test.com', 'Test Accounting'),
('aaaa0000-0000-0000-0000-000000000006', 'vendor@test.com', 'Test Vendor'),
('aaaa0000-0000-0000-0000-000000000007', 'other@test.com', 'Other Org User');

-- Create memberships
INSERT INTO memberships (user_id, organization_id, role, status) VALUES
('aaaa0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
('aaaa0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'property_manager', 'active'),
('aaaa0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'maintenance_tech', 'active'),
('aaaa0000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'leasing_agent', 'active'),
('aaaa0000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'accounting', 'active'),
('aaaa0000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'vendor_user', 'active'),
('aaaa0000-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'owner', 'active');

-- Create test property
INSERT INTO properties (id, organization_id, name, property_type, address_line1, city, state, zip)
VALUES ('pppp0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'Test Property', 'multi_family', '123 Main St', 'Austin', 'TX', '78701');

-- Create test financial transaction
INSERT INTO financial_transactions (
    id, organization_id, property_id, type, category, amount,
    transaction_date, status, created_by
)
VALUES (
    'ffff0000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'pppp0000-0000-0000-0000-000000000001',
    'rent_payment', 'rent', 1500.00,
    CURRENT_DATE, 'completed',
    'aaaa0000-0000-0000-0000-000000000001'
);
```

### 2. Policy test queries

After creating test data with service_role, test each role by simulating JWT context:

```sql
-- TEST: Accounting can see financial transactions
-- (Simulate by querying with a JWT that has accounting role)
-- In application code:
--   const { data } = await supabase.from('financial_transactions').select('*')
-- Expected: returns the transaction

-- TEST: Maintenance tech CANNOT see financial transactions
-- Expected: returns empty array (0 rows)

-- TEST: Cross-tenant isolation
-- User from Org B queries properties
-- Expected: returns 0 rows (they can't see Org A's property)

-- TEST: Suspended user gets no data
-- Update membership status to 'suspended', then query
-- Expected: returns 0 rows for every table
```

### 3. Integration tests (in the Next.js app)

```typescript
// tests/rls/financial-access.test.ts
describe('Financial transaction RLS', () => {
  it('owner can read transactions', async () => {
    const client = createClientAs('owner@test.com');
    const { data, error } = await client.from('financial_transactions').select('*');
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });

  it('maintenance tech cannot read transactions', async () => {
    const client = createClientAs('tech@test.com');
    const { data, error } = await client.from('financial_transactions').select('*');
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // RLS filters them out
  });

  it('user from other org sees nothing', async () => {
    const client = createClientAs('other@test.com');
    const { data } = await client.from('properties').select('*');
    expect(data).toHaveLength(0);
  });

  it('vendor only sees assigned work orders', async () => {
    const client = createClientAs('vendor@test.com');
    const { data } = await client.from('work_orders').select('*');
    data.forEach(wo => {
      expect(wo.vendor_id).toBe(testVendorId);
    });
  });
});
```

### 4. Manual smoke tests (checklist)

Run these after every schema change:

- [ ] Sign up new user → org + membership auto-created
- [ ] Invite team member → they see org data after accepting
- [ ] Switch orgs → only new org's data visible
- [ ] Suspend a user → they see 0 rows on next query
- [ ] Maintenance tech → only sees assigned work orders
- [ ] Vendor user → only sees their assigned work orders
- [ ] Leasing agent → cannot see financial transactions
- [ ] Accounting → can see transactions, cannot create properties
- [ ] Owner deletes property → soft-deleted, invisible to all queries
- [ ] Create transaction as tech → rejected by RLS
- [ ] Insert property with wrong org_id → rejected by WITH CHECK
