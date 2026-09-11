# EDOS Poultry360 — Architecture

This is the system architecture reference. For *what's built vs. deferred*
and the detailed reasoning behind specific decisions, see
[README.md](README.md). For the full product vision, see
[PRODUCT_SPEC.md](PRODUCT_SPEC.md).

## 1. Stack at a glance

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), TypeScript, React 19 |
| Styling | Tailwind CSS v4 |
| Database | Supabase Postgres — shared project `edos_db`, this app owns everything prefixed `poultryedos_` |
| Auth | Supabase Auth (`@supabase/ssr`), cookie-based sessions |
| Authorization | Postgres Row-Level Security (RLS) — every table, no app-layer permission checks as the source of truth |
| Offline | IndexedDB (native API), a queue-and-sync pattern for one flow (Record Today) |
| Maps | Leaflet + free OpenStreetMap tiles |
| PDF | jsPDF + jspdf-autotable, generated client-side |
| Payments | M-Pesa Daraja (architecture-complete, gated behind env vars) |
| AI | Deterministic calculations by default; optional Claude API call for free-text phrasing only, gated behind `ANTHROPIC_API_KEY` |
| Hosting | Vercel (or equivalent Next.js host) |

## 2. Why a shared database

`edos_db` hosts several unrelated products (a POS system, a hospital
system, a lab system, a lending platform, a booking system, and this one).
Every object this app owns — tables, functions, triggers, policies — is
prefixed `poultryedos_`, so nothing here can collide with or accidentally
expose another product's data. This app **only** reads/writes its own
prefixed tables; it never touches another product's tables.

## 3. Multi-tenancy model

A **tenant** is a farm operation (an individual smallholder, or a
cooperative/network of many farmers). A **farmer** is a person within a
tenant. For an individual smallholder these are 1:1 (the signup becomes
both the tenant's owner and its one farmer); a network tenant can hold
many farmers, most without their own login.

```
Tenant (poultryedos_tenants)
  └─ Tenant Membership (role: owner/admin/farm_manager/field_officer/farmer/veterinary_officer)
       └─ Farmer (poultryedos_farmers) — optional; a membership doesn't require one
            └─ Farm (poultryedos_farms)
                 └─ House (poultryedos_houses)
                      └─ Flock/Batch (poultryedos_flocks)
                           └─ Daily Record (poultryedos_daily_records)
                                └─ Production / Health / Feed / Sales / Finance rows
```

**How a tenant is created**: self-serve only, via `poultryedos_create_tenant()`
(a `SECURITY DEFINER` RPC), fired once from the onboarding wizard's first
step. It atomically creates the tenant, makes the signing-up user its
`owner`, and (via an `AFTER INSERT` trigger) starts a 14-day trial
subscription. There is no other way to create a tenant in-app.

**How a farmer joins an existing tenant** (as opposed to creating their
own): via a farmer invite (`poultryedos_farmer_invites` + the
`poultryedos_accept_farmer_invite()` RPC) — a link an owner/admin
generates from **Team**, sent out-of-band (WhatsApp/SMS/email; the app
does not send it for you). Opening the plain `/signup` page instead
always creates a **new**, separate tenant.

## 4. Authorization: RLS is the source of truth

Every `poultryedos_` table has RLS enabled. There is no fixed generic
role/permission engine (deliberately — see README's "Deliberately
deferred") — instead, a small set of Postgres helper functions gate
access, and every table's policy is written in terms of them:

- `poultryedos_is_tenant_member(tenant_id, roles[])` — "is the current
  user an active member of this tenant, optionally with one of these
  roles?" The backbone of nearly every policy in the schema.
- `poultryedos_is_subscription_active(tenant_id)` — derives whether a
  tenant's subscription currently permits writes (see §7). ANDed into the
  write policies of every core operational table.
- `poultryedos_is_super_admin()` — checks a one-row-per-admin allowlist
  table. Used only inside the two super-admin RPCs (§8), never directly
  in a table policy.

**Convention for every new function**: Postgres grants `EXECUTE` to
`PUBLIC` (which includes `anon`) by default. Every function in this
schema explicitly revokes from `public`/`anon` and grants only to
`authenticated` (or, for pure trigger functions nobody should call
directly, revokes from `authenticated` too). This was audited and fixed
multiple times over the project's history (migrations `0004`, `0005`,
`0011`, `0021`) and is checked after every schema change via Supabase's
security advisor.

## 5. Application structure

```
src/
  app/
    (marketing/auth pages: /, /login, /signup, /onboarding, /invite/[token])
    app/                    ← the authenticated app shell (src/app/app/layout.tsx)
      home, record, flock, sales, advice, more    ← farmer-facing
      network, team, tasks, reports               ← owner/admin-facing
      field, field/visits                         ← field-officer-facing
      billing, content, decisions, assistant, superadmin
    api/
      mpesa/stk-push, mpesa/callback
      assistant
  components/app/           ← one file per feature, mostly "use client"
  lib/
    data/                   ← server-only data-fetching functions (Supabase queries)
    ai/                     ← pure prediction functions + the assistant's Q&A logic
    payments/, sms/         ← external-integration interfaces
    supabase/               ← client.ts (browser), server.ts (SSR/RSC), admin.ts (service-role, webhook-only)
    i18n/                   ← EN/SW dictionaries
supabase/
  migrations/               ← one file per schema change, applied directly against
                              the live project (no local Supabase stack in this setup)
  seed.sql                  ← global reference data (poultry types, expense categories,
                              knowledge base articles, subscription plans) — idempotent
```

**Server vs. client boundary**: pages under `src/app/app/*/page.tsx` are
Server Components — they call `src/lib/data/*` functions directly (which
use the server-side Supabase client, reading the request's cookies).
Interactive pieces are separate `"use client"` components that call the
*browser* Supabase client (`src/lib/supabase/client.ts`) directly for
writes — there's no server-actions layer; a click handler calls
`supabase.from(...).insert(...)` or `supabase.rpc(...)` and then
`router.refresh()` to re-fetch the server-rendered data.

**Nav is server-computed, not a client guess**: `src/app/app/layout.tsx`
resolves one of three bottom-nav variants (`farmer` / `field` / `admin`)
from the signed-in user's membership role and whether they have a farmer
profile of their own — computed once, server-side, per request.

## 6. Key patterns used throughout

- **Trigger-maintained computed columns**, never computed by the app:
  `poultryedos_flocks.current_quantity` (recomputed from daily records'
  mortality+culls+sold whenever they change), `poultryedos_inventory_items.stock_on_hand`
  (from inventory transactions), `poultryedos_purchase_orders.total_cost_cents`
  (summed from line items). A `check` constraint on `current_quantity`
  makes it physically impossible to record more losses than birds that
  exist.
- **Derive at read time, don't pre-compute/store**: `biosecurityScore()`,
  `deriveSubscriptionStatus()`, `computeFeedEfficiency()`, and the AI
  prediction functions (`src/lib/ai/predictions.ts`) are all pure
  functions run fresh on every read. Nothing here has a "recalculate"
  button or a stale cached score.
- **No cron — lazy generation instead**: there's no background worker.
  `ensureDueNotifications()` (`src/lib/data/notifications.ts`) runs once
  per app-layout render for the signed-in user and upserts whatever's
  currently due (vaccination soon, low stock, mortality/production
  alerts, subscription issues), keyed by a `dedupe_key` so repeated runs
  never create duplicates.
- **`SECURITY DEFINER` RPCs for controlled cross-cutting reads/writes**,
  instead of loosening a base table's RLS: `poultryedos_list_tenant_members`
  (exposes `auth.users` emails without a direct grant on `auth.users`),
  `poultryedos_super_admin_list_tenants`/`..._set_tenant_status` (cross-tenant
  access, scoped to exactly two audited functions rather than five
  loosened table policies), `poultryedos_create_tenant`/`..._create_purchase_order`
  (atomic multi-row writes in one transaction).
- **Offline queue for exactly one flow**: Record Today always writes to
  an IndexedDB queue first (`src/lib/offline/db.ts`), then attempts an
  immediate sync if online (`src/lib/offline/sync.ts`) via an upsert keyed
  on `(flock_id, record_date)` — safe to retry, safe if partially synced
  already. Nothing else in the app works offline; see README for exactly
  why.

## 7. Subscriptions & billing enforcement

```
poultryedos_subscription_plans (global catalog: starter/growth/professional/enterprise,
                                 jsonb limits: farmers/farms/houses/flocks/users/field_officers)
        │
poultryedos_subscriptions (one per tenant; stored status: trial/active/cancelled)
        │
        ├─ Effective status derived at read time (deriveSubscriptionStatus() in TS,
        │  poultryedos_is_subscription_active() in SQL — kept in sync manually):
        │  trial → active → past_due → grace_period → suspended
        │
        ├─ HARD write block: poultryedos_is_subscription_active(tenant_id) is ANDed
        │  into the write policy of every core operational table (farms, flocks,
        │  daily records, health, sales, expenses, inventory, ...). Reads always
        │  stay open — a suspended tenant's data is never hidden or deleted.
        │
        └─ HARD plan limits: BEFORE INSERT triggers (not RLS — a trigger can tell
           "new row" apart from "editing an existing one", so a plan downgrade
           never retroactively blocks edits to rows that already exceed a new,
           lower limit) on farmers/farms/houses/flocks/tenant_memberships.
```

Billing/payment tables themselves (`poultryedos_subscriptions` writes,
`poultryedos_mpesa_transactions` inserts) are deliberately **excluded**
from the suspension gate — a suspended tenant must always be able to
reach its own billing page and pay to reactivate.

M-Pesa (`src/lib/payments/mpesa.ts`) implements the real Daraja
request/response shape end-to-end but is gated behind `MPESA_*` env vars;
unset, it returns a typed `not_configured` result rather than faking a
payment. The callback route (`src/app/api/mpesa/callback/route.ts`) is
the only code path allowed to mark a payment successful, using a
service-role client (`src/lib/supabase/admin.ts`) since Safaricom's
webhook has no user session — verified live that a tenant cannot mark
their own payment successful themselves (no RLS policy grants that).

## 8. Cross-tenant super admin

One real, allowlisted account can see and act across every tenant, via
`/app/superadmin`. Deliberately scoped narrower than a generic "super
admin role":

- `poultryedos_super_admins` — a one-column allowlist with **no write
  policy at all** (not even for existing super admins) — it can only ever
  be changed by direct SQL, so no session, however compromised, can
  self-escalate into it.
- No base table's RLS was loosened. Instead, exactly two `SECURITY DEFINER`
  RPCs (`poultryedos_super_admin_list_tenants`,
  `..._set_tenant_status`) each check the allowlist internally and
  read/write across tenants only inside that one audited function.
- Suspend/reactivate reuses the exact enforcement in §7 — no second,
  independent kill-switch.

## 9. AI/ML engine — scope is deliberate

Spec sections 49-55 call for a 5-level AI maturity model and explicitly
forbid inventing intelligence the data can't support. This app implements
**Levels 1-3 only** (rule-based → historical-trend comparison → simple
statistical forecasting) — there is no cross-tenant historical dataset or
training pipeline to build real Level 4/5 machine learning on, and
attempting it would mean fabricating exactly what the spec forbids.

- `src/lib/ai/predictions.ts` — pure functions (egg-production trend,
  feed stock-out), each returning a value + confidence + what data was
  used + a plain-language explanation, or an explicit
  `insufficient_data` status with why.
- **Decision Center** (`/app/decisions`) is a *view* over the existing
  notifications table, not a separate subsystem.
- **AI Assistant** (`/app/assistant`) answers the spec's own example
  questions with real deterministic calculations — no language model
  involved in producing a number. An optional free-text mode only
  activates with a real `ANTHROPIC_API_KEY`, and even then the model only
  *phrases* the same deterministic facts; it never gets raw table access.

## 10. Verification methodology

There is no local Supabase stack in this setup — migrations are written
as files under `supabase/migrations/` for history/review, then applied
directly against the live `edos_db` project via Supabase's MCP tools.
Every schema change in this project's history has been verified the same
way, not just applied:

1. Apply the migration.
2. Run Supabase's security advisor; resolve every new finding (or confirm
   it's an already-accepted, intentional pattern — e.g. a `SECURITY DEFINER`
   RPC that's meant to be `authenticated`-callable because it
   self-checks authorization).
3. Exercise the change under a **real impersonated `authenticated` role**
   (a JWT claim swap, not the Postgres superuser) — using a **fully
   synthetic, disposable test user and tenant**, never a real account —
   to confirm both the happy path and that an unrelated user gets zero
   rows.
4. Delete all test data (and the throwaway auth user) afterward.

See README.md's "Verification performed" section for the specific,
dated record of every check actually run.
