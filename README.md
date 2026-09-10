# EDOS Poultry360

Manage every flock. Every farmer. Every decision.

This repo currently implements the **smallholder farmer mode** vertical
slice (spec phases 1–3), **Health & Business** (phases 4–5), **Field
officers & networks** (phase 6), and a round of fixes driven by **real
farmer requirements audited against the running app** (see "Real-world
requirements audit" below) — the full 106-section product vision lives in
[PRODUCT_SPEC.md](PRODUCT_SPEC.md). See "What's deferred" below before
assuming any given feature exists.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase** — Postgres + Auth + Row-Level Security, project `edos_db`
  (shared with several other unrelated products; every table/function this
  app owns uses the `poultryedos_` prefix)
- IndexedDB-backed offline queue (native API, no external dependency) + a
  minimal service worker for app-shell resilience — see "Offline support"
  below for exactly what this does and doesn't cover.

## Getting started

```bash
npm install
npm run dev
```

`.env.local` already points at the shared `edos_db` Supabase project with
its public anon key. See `.env.example` for a template.

Visit:

- `/` — marketing landing page
- `/signup` → `/onboarding` — create an account, then a 3-step wizard
  (farm → house → first flock) that gets a new smallholder to their first
  usable "Record Today" screen
- `/app/home` — the farmer dashboard (requires being onboarded)

## Database

All schema lives in `supabase/migrations/*.sql`, applied directly against
the live `edos_db` project via the Supabase MCP tools (there is no local
Supabase stack in this setup — the files are kept for history/review, not
`supabase db push`). Highlights:

- **Tenant = farm operation, farmer = a person within it.** For this
  individual-smallholder slice they're 1:1 (one signup → one tenant → one
  farmer, who is also the tenant's `owner`), but the schema already
  separates them so a future cooperative/network tenant can hold many
  farmers, most without their own login. See spec sections 39/40.
- **`poultryedos_flocks.current_quantity` is trigger-maintained**, recomputed
  from `initial_quantity` minus the sum of every daily record's
  mortality+culls+birds_sold whenever a daily record changes. The farmer (or
  the UI) never computes this by hand, and a `check` constraint makes it
  physically impossible to record more losses than birds that exist — this
  was verified directly: an insert claiming 10,000 deaths on a 250-bird
  flock is rejected by the database, not just the UI.
- **RLS verified under real impersonated auth**, not just as the DB
  superuser: the full onboarding chain (create tenant → farmer → farm →
  house → flock → daily record) was run as an authenticated role with a
  real user's JWT claims, and a second, unrelated user was confirmed to see
  zero rows of that tenant's data.
- **Function grants were locked down explicitly.** Postgres grants `EXECUTE`
  to the `PUBLIC` pseudo-role by default on every new function (which
  includes `anon`), and in this same `edos_db` project some functions also
  pick up a *separate*, direct grant to `anon`/`authenticated` from a
  platform-level default-privilege rule. Both mechanisms were audited and
  revoked where they shouldn't apply — see migrations `0004`/`0005`.

Re-seed global reference data (poultry types + a few knowledge base
articles) any time with `supabase/seed.sql` (idempotent).

## What's built

- **Onboarding**: signup → guided 3-step wizard → lands on the farmer home
  screen with a real flock ready to record against. Resumable — if a farmer
  abandons onboarding partway, returning to `/onboarding` picks up at the
  right step instead of losing progress or duplicating records.
- **Farmer home** (spec §7): greeting, today's birds/eggs/feed/sales, a
  rule-based mortality alert (see below), next upcoming vaccination.
- **Record Today** (spec §8): deaths, eggs, feed, sales, notes — the BASIC
  tier of progressive data entry (§9). Always goes through the offline
  queue, even when online, so there is exactly one code path to test and
  trust, and re-saving the same day safely upserts rather than duplicating.
- **Flock view**: current flock's age, mortality %, and recent daily
  records.
- **Sales**: last 30 days of recorded sales and a running total.
- **Advice** (spec §14): a knowledge base of general poultry husbandry
  guidance, seeded with real (non-fabricated, non-diagnostic) content —
  deliberately written to never claim a specific diagnosis or medication
  dosage, consistent with the spec's AI/content-safety principle even
  though this is static CMS content, not AI-generated.
- **I need help** (spec §13): a support ticket a farmer can raise, with
  example problems and a priority picker.
- **Offline support** (spec §11) — see the dedicated section below.
- **Auth**: signup/login/forgot-password/reset-password, all working
  end-to-end through the shared `edos_db` project's now-configured SMTP.
- **Health** (spec §24): log symptoms/treatment/vet contact per flock, mark
  resolved. One table, not two (see "Health vs. veterinary visits" note in
  the migration) — a vet visit is just a health event with a vet's name on
  it, and splitting it into a second table would only mean joining two
  tables every time you want "what happened with this flock's health."
- **Vaccination** (spec §25): schedule, mark administered, history — the
  farmer home screen's "upcoming vaccination" card now has a real page
  behind it instead of being the only place it showed up.
- **Biosecurity** (spec §26): a daily 9-item checklist per farm, with a
  score computed at read time (not stored) so the scoring weights can
  change later without a backfill.
- **Expenses** (spec §33): logged against 15 seeded global categories
  (Feed, Vaccines, Labour, etc.), optionally attributed to a flock.
- **Sales, upgraded** (spec §30/31): the original "amount in daily record"
  quick total still works unchanged, and now sits alongside a proper
  itemized sales log (product, quantity, customer, payment method). The
  Sales page total is explicitly both, added together and labeled
  separately, so nothing is silently double-counted.
- **Inventory & procurement** (spec §28/29/32): stock items with
  trigger-maintained `stock_on_hand` (same pattern as flock bird counts),
  manual usage/adjustment logging, suppliers, and purchase orders —
  marking a PO "received" automatically stocks the linked item.
- **Finance** (spec §34/35): a per-flock profitability view (revenue minus
  expenses), pulling from both the quick and itemized sales sources without
  double-counting.
- **Multi-farmer tenants** (spec §39/40): a tenant is no longer forced to be
  exactly one farmer. Owners/admins get a **Team** page to add farmers they
  manage directly (no login required — `poultryedos_farmers.user_id` stays
  null) and, when a farmer should have their own login, generate a
  copyable invite link. `/invite/[token]` is the public acceptance page; it
  works whether the invitee is already logged in, needs to sign up, or
  needs to log in first (all three preserve the invite link via a `?next=`
  redirect through the normal auth pages). See "Who is the main farmer?"
  below for the design reasoning.
- **Field officers** (spec §37/38): owners/admins assign a field officer to
  specific farmers (Team); the officer gets their own **Farmers**/**Visits**
  nav showing only what's assigned to them (RLS-enforced, verified — a
  second field officer or unrelated user sees zero rows of another
  officer's visits). Visits follow the spec's exact status chain
  (Assigned → Traveling → Visited → Assessment → Recommendation → Action
  required → Follow-up → Resolved), capturing GPS best-effort when marking
  "Visited."
- **Tasks** (spec §37): assignable to any tenant member, optionally tied to
  a farmer or a visit; a personal "my tasks" checklist for anyone, plus an
  all-tasks view and an assign-a-task form for owners/admins.
- **Network dashboard** (spec §39): aggregated 7-day stats (farmers, farms,
  active flocks, total birds, mortality, eggs, sales, expenses) across the
  whole tenant — the actual "roll-up across many farmers" view a
  cooperative admin needs, as opposed to one farmer's personal home screen.
- **Role-aware navigation**: the bottom nav is no longer one fixed set of
  tabs. An individual farmer (or a network's member farmer) still sees
  Home/Record/Flock/Sales/Advice/More exactly as before; a pure field
  officer (no farmer profile of their own) sees Farmers/Visits/Tasks/Advice
  instead; a pure cooperative admin (also no farmer profile) sees
  Network/Team/Tasks/More. This is resolved server-side in `/app/layout.tsx`
  from the user's membership role and whether they have a farmer profile —
  not a client-side guess.

### Who is the "main" farmer?

Deliberately: there isn't one, and we didn't add a flag pretending there
is. For an individual smallholder tenant, "the main farmer" already just
means "whoever holds the `owner` role" — true before this phase and still
true now. For a cooperative/network tenant with several farmers, there
is no hierarchy among them in real life — there's an operator (owner/admin,
who may or may not be a farmer themselves) and a set of equal member
farmers, some visited by field officers. Modeling a fake "primary farmer"
ranking would misrepresent how cooperatives actually work, so
`poultryedos_farmers` has no such field.

## Real-world requirements audit

A stakeholder (Naomi) sent a plain-language list of what a Brooding record,
an Egg Production record, and a Sales record need to capture. Rather than
guessing whether the app already covered it, every point was checked
against the actual running schema and UI, and a written audit was produced
*before* any code changed. What the audit found and what got fixed:

| Requirement | Was it covered? | Fix |
|---|---|---|
| Breed | Schema existed, no form ever set it | `FlockFormFields`, used by onboarding, `/app/flock/new`, and flock-detail editing |
| Company (hatchery) | **Missing entirely** — `poultryedos_flocks` never had a `supplier` column, even though the original spec (§18) always called for breed/source/supplier as three separate fields | Added `supplier` column (migration `0016`) + exposed in the same forms |
| Source of birds | Schema existed, no form ever set it | Same fix as above — and confirmed as genuinely distinct from "Company" (a farmer often buys through an agrovet, not the hatchery directly) |
| Feed per bird per day, in grams | Not computed anywhere — only a flock-total kg/day existed | `computeFeedEfficiency()` (`src/lib/feed-efficiency.ts`), shown on the flock page and in both report exports |
| Feed conversion ratio | **Never implemented**, despite being in the spec since day one (§19/§28) | Same helper computes kg feed / dozen eggs, shown alongside grams/bird/day |
| Vaccination (age-specific) | Only an absolute date, no way to say "due at day 14" | Added `age_days` to `poultryedos_vaccination_schedules`; the schedule form now lets you enter "days after placement" and computes the date, or fall back to a specific date |
| Medications — antibiotics, multivitamins, dewormers | Only a free-text field buried inside a health event, no category, no routine-medication use case | New `poultryedos_medication_records` table + `/app/medications` page, parallel to vaccination |
| Customer contacts (phone) | Column existed, but the only way to create a customer (inline during a sale) never asked for it, and there was no way to edit it afterward | Sales' quick-add now asks for phone too, and a full `/app/customers` page was added for managing existing customers |
| Summary should be printable | **Nothing existed at all** — no print, export, or PDF anywhere in the app | See below |
| Sales — date/client/contacts/payment/quantity/price | All already covered | No change needed |

### Printable / downloadable reports

Both `/app/flock/[id]` and `/app/sales` now have a **Print** button and a
**PDF** button:

- **Print** uses the browser's native print dialog against a dedicated,
  plain-text "report" rendering of the same page (`hidden print:block`,
  toggled off in the interactive view) — on both desktop and mobile
  (Android Chrome and iOS Safari), the print dialog's own "Save as PDF"
  option works from this.
- **PDF** generates an actual `.pdf` file directly, client-side, via
  `jspdf` + `jspdf-autotable` (`src/lib/pdf/simple-report.ts`), and
  triggers a real download — no server, no screenshot-based rendering
  (so the text stays small, sharp, and selectable rather than a rasterized
  image). Both buttons build from the exact same data, so they never
  disagree with each other or with what's on screen.

The Flock report covers batch details (including the new breed/company/
source fields), production summary, feed efficiency, and a financial
summary. The Sales report covers the date/client/contacts/payment/quantity/
price table Naomi asked for directly.

## Offline support — what it actually covers

This is the one place worth being precise about, since "offline support" can
mean very different amounts of engineering:

- **What works fully offline**: filling in and saving "Record Today." The
  form writes straight to an IndexedDB queue first; if the browser is
  online, it also attempts an immediate sync, but the save always succeeds
  locally regardless of connectivity. When connectivity returns (the
  browser's `online` event), everything queued syncs automatically via an
  upsert keyed on `(flock_id, record_date)` — safe to retry, and safe if the
  same day was already partially recorded before going offline.
- **What does NOT work offline**: viewing the dashboard, flock history,
  sales, or advice content for the first time with no cached data — those
  are server-rendered pages that need a network round trip. The service
  worker only caches static shell assets (the manifest and icon), not
  per-user dynamic HTML; building real "view your last-known dashboard
  offline" would need a different architecture (client-side data caching,
  not SSR) and wasn't in scope for this pass.
- Rather than overclaim, the sync status badge in the app header only ever
  shows one of: Online, Offline, Syncing, Synced, Sync failed, (N pending) —
  matching spec §11's explicit state list.

## Deliberately deferred

- **Generic configurable RBAC** (spec §5, the `poultryedos_roles` /
  `permissions` / `role_permissions` / `user_roles` tables): revisited at
  exactly the point this note said to (Phase 6, once cooperative tenants
  with multiple real roles existed) and reaffirmed — field officers now
  have real, different row-level access (their own assigned visits/tasks
  vs. an owner/admin's tenant-wide view), and the fixed role column plus
  per-table RLS policies expressed that correctly without needing a
  generic permission engine underneath. Still deferred, now on purpose
  rather than by default: build the generic tables when a tenant actually
  needs to *define new custom roles*, not just use the ones already coded.
- **Cooperatives/aggregators as a distinct concept, contract farming, the
  marketplace** (spec §40/41/42): a network tenant with many farmers and
  field officers exists now, but there's no separate "cooperative"
  organization type, input-distribution tracking, contract terms, or any
  marketplace listing/matching between farmers and buyers.
- **Maps** (§37/61): field visits capture GPS coordinates, but there's no
  map view rendering farm/farmer locations or field officer routes yet.
- **Phase 7 onward**: M-Pesa, SMS/USSD, subscriptions, the CMS/super-admin
  area, and the full AI/ML engine (the one mortality alert implemented is
  explicitly Level-1 rule-based, per spec §51 — a same-flock
  trailing-average comparison, not a model, worded as "worth a closer
  look" / "veterinary review recommended," never a diagnosis).
- **Multi-line purchase orders**: each PO is one item from one supplier,
  which covers the real smallholder/early-commercial workflow (a bag of
  feed, a vial of vaccine). A multi-line PO system is real added
  complexity worth building when there's an actual business ordering many
  items in one purchase, not before.
- **Swahili localization** (§10): the architecture (all copy in components,
  no business logic depending on display strings) doesn't block adding it,
  but no translation dictionary exists yet — every label is hardcoded
  English.
- **Real brand icon assets**: `public/icon.svg` is a placeholder mark, not
  real EDOS Poultry360 branding.

## Verification performed

- `npm run build` and `npm run lint` pass clean.
- The `current_quantity` trigger and its data-integrity guard were verified
  directly: a normal two-day sequence of daily records correctly reduced
  bird count (250 → 247), and an attempt to record 10,000 deaths on a
  250-bird flock was correctly rejected by the database's check constraint,
  rolling back the whole insert.
- The entire onboarding-to-daily-record chain was re-run under a real
  impersonated `authenticated` role (not the Postgres superuser) to confirm
  RLS actually allows the intended flow, and a second unrelated user was
  confirmed to see zero rows of the test tenant's data.
- Server-rendered routes were smoke-tested via HTTP (landing page, login,
  signup, and every protected `/app/*` and `/onboarding` route correctly
  redirecting an unauthenticated request to `/login`).
- Security advisors were checked and every `poultryedos_` finding resolved
  except the two expected "authenticated users can call this RPC" notices
  (intentional — `poultryedos_create_tenant` and `poultryedos_is_tenant_member`
  are meant to be authenticated-callable).
- **Phase 4+5 additions were verified the same way**, under the same real
  impersonated `authenticated` role: health events, a biosecurity check,
  an inventory item, a purchase order marked "received" (confirmed it
  auto-created a stock-in transaction and moved `stock_on_hand` from 0 to
  50), a stock-out and a negative adjustment (confirmed it correctly
  reached 38), a customer, a sale, and an expense — all inserted
  successfully under RLS, then cleaned up.
- **Two more real bugs were caught this way, not left for you to find**:
  (1) `unique(tenant_id, code)` / `unique(tenant_id, name)` on the global
  reference tables (poultry types, expense categories) never actually
  deduplicated global rows, because SQL treats every `NULL` as distinct —
  re-running the seed would have silently duplicated every global category
  each time. Fixed with partial unique indexes (migration `0012`). (2) The
  inventory `adjustment` transaction type couldn't represent a decrease
  (spoilage, a discovered shortage) because the original check constraint
  forced every transaction's quantity to be positive — fixed before it was
  ever applied, so a negative adjustment now works exactly as tested above.
- **Phase 6 was verified the same way, including the parts that only make
  sense under real RLS**: a second farmer added to an existing tenant
  without a login, an invite generated and viewed *as `anon`* (no session
  at all, confirming the public acceptance screen actually works
  unauthenticated), accepted by a different real user (confirmed their
  farmer record got `user_id` linked, a `farmer`-role membership was
  created, and a second acceptance attempt on the same token was correctly
  rejected as no-longer-pending), a field officer assigned to that farmer,
  a visit created and advanced to "visited" by the officer, and — the
  actual point of the exercise — a *third*, unrelated real user confirmed
  to see zero rows of that visit. All test data cleaned up afterward.
- All server-rendered `/app/*` routes (including the six new ones:
  `/app/team`, `/app/network`, `/app/field`, `/app/field/visits`,
  `/app/tasks`) and `/invite/[token]` were smoke-tested via HTTP.
- Could **not** get a real browser running in this sandbox (as noted for the
  appointment-booking-system project — Playwright's Chromium download is
  network-blocked here), so the client-side wizard and offline-queue UI have
  not been visually verified end-to-end. Please click through `/signup` →
  `/onboarding` → `/app/record` yourself, including toggling your browser's
  offline mode, before relying on it.
