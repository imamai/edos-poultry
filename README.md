# EDOS Poultry360

Manage every flock. Every farmer. Every decision.

This repo currently implements the **smallholder farmer mode** vertical
slice (spec phases 1–3), **Health & Business** (phases 4–5), **Field
officers & networks** (phase 6), **Platform** (phase 7 — subscriptions,
M-Pesa, SMS, notifications, CMS, reports; see below), and a round of fixes
driven by **real farmer requirements audited against the running app** (see
"Real-world requirements audit" below) — the full 106-section product
vision lives in [PRODUCT_SPEC.md](PRODUCT_SPEC.md). See "What's deferred"
below before assuming any given feature exists.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase** — Postgres + Auth + Row-Level Security, project `edos_db`
  (shared with several other unrelated products; every table/function this
  app owns uses the `poultryedos_` prefix)
- IndexedDB-backed offline queue (native API, no external dependency) + a
  minimal service worker for app-shell resilience — see "Offline support"
  below for exactly what this does and doesn't cover.
- **Leaflet** + free OpenStreetMap tiles for maps (no paid API key) —
  see "Maps" below.

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
  below for the design reasoning. Each farmer on **Team** links to
  `/app/team/[farmerId]` — a per-farmer drill-down (their farms, every
  flock with a live link into its full `/app/flock/[id]` detail, and a
  7-day mortality/eggs/sales/expenses summary scoped to just that farmer)
  for "show me just this one farmer," as opposed to **Network**'s
  tenant-wide roll-up. No new tables or RLS policies — an owner/admin
  could already read any farmer/farm/flock row in their tenant; this is
  new UI composing existing reads, verified live against a synthetic
  test tenant with a second, directly-managed farmer (correct farm/flock/
  7-day numbers; an unrelated user saw zero rows, as always).
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

### Platform (phase 7)

- **Subscriptions** (spec §45/46): every tenant gets a 14-day trial on the
  Starter plan automatically (a DB trigger on tenant creation — mirrors the
  farmer-invite 14-day expiry pattern). `/app/billing` (owner/admin) shows
  the plan, an *effective* status (trial/active/past_due/grace_period/
  suspended/expired) computed at read time from stored dates —
  `deriveSubscriptionStatus()`, the same "derive, don't pre-compute"
  approach as `biosecurityScore()` — usage bars against the plan's
  configurable limits, and self-service plan switching. **Enforcement is
  now hard, at the database level** (migration `0022`, added once live
  verification was possible): `poultryedos_is_subscription_active(tenant_id)`
  is ANDed into the write policies of every core operational table
  (farmers/farms/houses/flocks/daily records/health/vaccination/
  medications/biosecurity/expenses/customers/sales/inventory/suppliers/
  purchase orders/support tickets) — a suspended or cancelled tenant can no
  longer write to any of them, full stop, while reads stay open (data is
  never hidden, only new writes blocked). Plan limits (farmers/farms/
  houses/flocks/team members/field officers) are enforced by `BEFORE
  INSERT` triggers rather than RLS, since a trigger can tell "creating a
  new row" apart from "editing an existing one" (a plan downgrade must
  never retroactively block editing rows that already exceed a new, lower
  limit) — every manager component already surfaces the raised error via
  `error.message`, so no new UI was needed. Deliberately excluded from both
  gates: billing/payment tables themselves, so a suspended tenant is never
  locked out of paying to reactivate.
- **M-Pesa** (spec §44): `src/lib/payments/mpesa.ts` implements the real
  Daraja STK-push request/response shape end-to-end (auth, STK push,
  callback parsing), gated behind `MPESA_*` env vars that are **unset in
  this environment** — no sandbox credentials were available here, so it
  returns a typed `not_configured` result rather than faking a payment,
  exactly the "clean interface, documented integration point" spec §106
  allows. `/api/mpesa/stk-push` (authenticated) and `/api/mpesa/callback`
  (public, service-role — Safaricom has no session) are both implemented
  but **untested against a live Safaricom sandbox**.
- **SMS** (spec §48): `src/lib/sms/provider.ts` defines the spec's exact
  interface (`sendSMS`/`sendBulkSMS`/`getBalance`/`getDeliveryStatus`) with
  a real, working `ConsoleSmsProvider` default (logs to
  `poultryedos_sms_logs`, no paid gateway needed) — swap in a real Kenyan
  provider later without touching any caller.
- **Notifications** (spec §47): a bell in the header (`/app/notifications`)
  backed by `poultryedos_notifications`. Since there's no cron/background
  worker, notifications are generated **lazily, once per page load** —
  `ensureDueNotifications()` upserts whatever's currently due (vaccination
  within 2 days, low/out-of-stock inventory, today's mortality alert,
  subscription trial ending or past due), keyed by a `dedupe_key` so
  repeated runs never spam duplicates.
- **CMS** (spec §67, tenant-scoped): `/app/content` lets an owner/admin
  create/edit their **own tenant's** advice articles (the seeded global
  library stays read-only, exactly as RLS already enforced before this
  phase — it just had no UI) and post announcements, which surface as a
  small banner on the farmer home page. There is no cross-tenant
  super-admin CMS — see "Deliberately deferred."
- **Reports** (spec §59/60/85): `/app/reports` (owner/admin/farm_manager)
  adds tenant-wide, date-ranged (7/30/90d) Production, Mortality, and
  Financial summaries — the multi-flock rollup a network admin needs, on
  top of the single-flock PDF/print already on `/app/flock/[id]`. Both PDF
  (`downloadSimpleReportPdf`) and a new CSV export are available.
- **Desktop layout**: the app shell was phone-width (`max-w-md`) at every
  screen size regardless of role. Per spec §65 ("Desktop is the expanded
  experience"), the admin/field variants now widen up to `max-w-5xl` above
  phone width — Network's stat grid and the header/bottom-nav container
  scale with it — and the farmer variant widens more modestly (`max-w-2xl`)
  so a smallholder on a shared PC isn't stuck in a phone-narrow column
  either, without turning "Record Today" into a stretched desktop form.
  Every width is an upper bound, not a fixed size, so phone rendering is
  unchanged.

### English + Swahili (phase 7 follow-up, spec §10)

Scoped deliberately, not attempted as a full-app translation: covers
exactly the "Simple Farmer Mode" 60-second daily flow (spec §8) — the
farmer bottom nav's labels, the Home dashboard, and Record Today, every
visible string. Admin/network/CMS/report screens and the Advice
library's actual article content (stored data, not UI chrome — a
different, much larger task) stay English-only for this pass.

- `src/lib/i18n/translations.ts` holds both dictionaries; adding a third
  language means adding one more key set there, nothing else, since all
  copy already lived in components with no logic depending on display
  strings (as `poultryedos_tenants.locale` — present since migration
  `0001` but unused until now — already assumed).
- The preference is tenant-wide, not per-user: a `LanguageToggle` on the
  Home page lets the tenant flip between EN/SW, gated by the same
  owner/admin-only RLS policy that already governed
  `poultryedos_tenants` updates. For the individual-smallholder tenant
  this feature targets, the farmer already *is* the owner, so this is
  effectively "my language" — a farmer-role member of a multi-farmer
  tenant can't change it, a deliberate scope line rather than building
  per-user locale preferences.
- Dynamically-generated text (the mortality alert's message, a farmer's
  own name) stays English/as-entered — only static UI copy is translated.

### Maps (phase 7 follow-up, spec §37/61)

`src/components/app/map-view.tsx` wraps Leaflet directly (not
`react-leaflet` — one fewer dependency) against free OpenStreetMap tiles,
no API key needed. Dynamically imported with `ssr: false` since Leaflet
touches `window` at module load and can't run server-side.

Scoped to what already has real data: field visits capture GPS when a
field officer marks one "Visited" (existing behavior, unchanged), so
`/app/field/visits` now renders a map of every visit that has a location,
pinned and labeled with farmer name + status, above the existing list.
**Farm-location mapping was deliberately not built** — see "Deliberately
deferred" below on why (no farm GPS is ever captured anywhere yet, so that
map would only ever render empty).

### Multi-line purchase orders (spec §32)

Migration 0010 deliberately kept a PO as one item from one supplier, with
an explicit note to revisit "when there's an actual business ordering many
items in one purchase, not before." `poultryedos_purchase_orders` had zero
rows in production, so migration `0024` reshapes it directly: the table is
now a header (supplier, status, dates) with line items in a new
`poultryedos_purchase_order_items` table.

- `total_cost_cents` on the header is trigger-maintained — summed from
  line items whenever they change, the same "the app never computes a
  derived value by hand" pattern as `poultryedos_flocks.current_quantity`.
- `poultryedos_create_purchase_order(tenant_id, supplier_id, items jsonb)`
  creates the header and every line atomically in one RPC call, mirroring
  `poultryedos_create_tenant`'s "one call, one transaction" shape — a
  client-side "insert header, then insert N lines" would risk an orphaned
  empty order if the line insert failed partway through.
- Marking a PO "received" now stocks every line item with an `item_id`,
  not just one — verified live: a 2-line order (one tracked in inventory,
  one not) correctly created exactly one stock-in transaction, for the
  tracked line only.
- The Inventory page's purchase-order form now has an "Add another item"
  button per order; the order list shows every line and the
  trigger-computed total.

### AI/ML engine (spec §49-55)

Levels 1-3 only (rule-based → historical-trend comparison → simple
statistical forecasting) — spec §51 explicitly prefers "not enough data
yet" over fabricated intelligence, and there's no cross-tenant historical
dataset or training pipeline to build real Level 4/5 machine learning on.
See "Deliberately deferred" below for exactly what that rules out.

- **Predictions** (`src/lib/ai/predictions.ts`, pure functions, same
  "derive at read time" shape as `biosecurityScore()`): egg production
  trend (recent-vs-prior 7-day comparison + a naive next-7-day
  projection) and feed stock-out (days remaining from a recent
  consumption rate). Every result carries the spec §52 fields — value,
  confidence, what data was used, plain-language explanation — or an
  explicit `insufficient_data` status with why, never a guess dressed up
  as one.
- **Decision Center** (`/app/decisions`, spec §53 — "what needs my
  attention?"): a *view* over the existing `poultryedos_notifications`
  table, not a new subsystem — the same alerts already in the header bell
  are grouped into HIGH / ATTENTION / MONITOR / OPPORTUNITY, each with the
  spec's "why does it matter / what to check / what to do" framing.
  `ensureDueNotifications()` gained two new checks (production decline,
  feed stock-out) alongside its existing five.
- **Flock forecasts**: `/app/flock/[id]` shows the egg-production
  forecast next to the existing feed-efficiency numbers.
- **AI Assistant** (`/app/assistant`, spec §54): the spec's own example
  questions ("Which flock is most profitable?", "Why did egg production
  decline?", "What are my biggest expenses?", etc.) as tappable buttons,
  each answered by a real deterministic calculation over the tenant's own
  data — no language model involved in producing a single number. A
  free-text box only appears if `ANTHROPIC_API_KEY` is configured (same
  "architecture-only, typed not-configured fallback" as M-Pesa/SMS); when
  present, Claude only *phrases* the same deterministic facts every canned
  question already computes — it never gets raw table access and is
  explicitly instructed not to diagnose or prescribe.
- Live-verified: the production-trend and feed-stockout math were checked
  against known inputs (a 150-vs-200-egg week produces exactly -25%/"down";
  a 5kg/day rate against 25kg stock produces exactly 5 days remaining), a
  synthetic test tenant's declining flock and depleting feed item correctly
  generated both new notification types with the widened
  `poultryedos_notifications` type constraint (migration `0025`), and an
  unrelated user saw zero of them. No new security-advisor findings (no
  new functions with grant issues — the only schema change was the
  constraint). Test data and the throwaway auth user deleted afterward.

### Cross-tenant super admin (spec §5/67)

A single real account — the platform's sole owner — can now see and act
across every Poultry360 tenant, at `/app/superadmin` (surfaced on More
only for that account). This was explicitly deferred earlier as a bigger,
more security-sensitive change; the design landed on here is narrower
than what was originally sketched:

- **No RLS was loosened on any base table.** The obvious approach — OR a
  `poultryedos_is_super_admin()` clause into the read policies of
  `poultryedos_tenants`/`subscriptions`/`farmers`/`farms`/`flocks` — was
  considered and rejected: it would permanently widen five tables'
  security posture to support one narrow admin screen. Instead, following
  the existing `poultryedos_list_tenant_members` pattern (migration
  `0015`), two `SECURITY DEFINER` RPCs
  (`poultryedos_super_admin_list_tenants`,
  `poultryedos_super_admin_set_tenant_status`) each check the new
  `poultryedos_super_admins` allowlist internally and read/write across
  tenants only inside that one audited function — no table's RLS changed
  at all.
- **The allowlist has no write policy, anywhere.** It can only be changed
  by direct SQL — the same way its one seed row was inserted — so no
  session, however compromised, can ever grant itself access.
- **Suspend/reactivate reuses the exact enforcement already built and
  verified in migration `0022`** (`poultryedos_is_subscription_active()`)
  rather than a second, independent kill-switch: suspending sets the
  tenant's subscription to `cancelled`, which every already-gated write
  policy immediately honors.
- The dashboard is a real desktop `<table>`, not the stacked-card pattern
  used elsewhere — the super admin is expected to be on a PC the large
  majority of the time, so the app-wide layout width logic
  (`src/app/app/layout.tsx`) now also gives that one account the wide
  admin layout everywhere, even on pages where he'd otherwise get the
  narrow farmer width (he also has his own farmer profile).
- **Live-verified**: a non-super-admin calling either RPC (including the
  target tenant's *own* owner, ruling out self-escalation) was rejected
  with `not_authorized`; the seeded real account correctly listed every
  tenant; suspend/reactivate was exercised against a disposable synthetic
  tenant — suspending blocked a real write attempt via the existing RLS
  gate, reactivating immediately restored it. The real production tenant
  was only ever read during verification, never suspended. Test tenant
  and throwaway auth user deleted afterward.

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

### Marketplace (spec §42) — farmer-listing side

The first slice of the three-way "Deliberately deferred" group
(Cooperatives §40 / Contract Farming §41 / Marketplace §42): a real,
public listings board. A tenant member (owner/admin/farmer) posts eggs,
birds, manure, or a feed request from `/app/marketplace`
(`poultryedos_marketplace_listings`, migration `0028`/`0029`), and anyone
— including a visitor with no Poultry360 account at all — can browse it at
the public `/marketplace` and at `/app/marketplace`'s browse tab, seeing
the listing's contact phone directly.

**Design**: every other table in this schema keeps reads tenant-scoped
and exposes any cross-cutting view through an audited `SECURITY DEFINER`
RPC rather than loosening a base policy (`poultryedos_list_tenant_members`,
the super-admin RPCs). `poultryedos_marketplace_browse()` follows the same
shape, except it's deliberately granted to `anon` too (mirroring
`poultryedos_view_invite`) — a marketplace only has value if a buyer who
isn't already a signed-in tenant member can find it. The base table
itself stays exactly as tenant-scoped and subscription-gated as every
other operational table (same `poultryedos_is_subscription_active()`
check as expenses/sales/purchase orders).

**Visibility is a deliberate, confirmed product choice**: fully public,
phone number included, same model as OLX/Jiji-style classifieds already
familiar in Kenya. The farmer opts into that by choosing to create a
public listing.

**Explicitly out of scope for this pass**: buyer accounts that "publish
demand" with their own login (a buyer just calls the number instead —
no second identity system was built to receive listings), contract
farming (§41), and a distinct Cooperative org type with input-distribution
tracking (§40) — each a separately-sized piece of work with no natural
overlap with a listings board.

**Live-verified** with two disposable synthetic tenants: tenant A's
listing was visible to tenant B's authenticated session *and* to a
completely anonymous client with no session at all via
`poultryedos_marketplace_browse()`; tenant B could not update or cancel
tenant A's listing directly against the base table (RLS silently
rejected it — 0 rows affected); tenant A's own owner could update their
own listing; suspending tenant A's subscription correctly blocked a new
listing insert with the same `42501` RLS rejection used everywhere else
in this schema; and a listing with `expires_at` in the past was correctly
excluded from browse results. **One real bug was caught during this
verification, before any real listing was ever created**: the table's
`created_by` column was `not null` with nothing (in the app or the
migration) ever populating it on insert — every real insert would have
failed outright. Fixed in `0029` to match this schema's actual existing
convention (nullable, `on delete set null`, same as `poultryedos_expenses`
and `poultryedos_daily_records`). All test tenants, farms, and throwaway
auth users deleted afterward.

### Point of Sale: multi-item sales, payments/balances, invoices/receipts, quotations

The user asked whether the system could sell to clients and produce PDF
invoices/quotations/receipts styled like the existing summary reports,
then reframed it directly: "should have POS section." Spec §30/31
explicitly called for `discount`, `balance`, `invoice`, and `receipt` on
a sale, and none of that existed — a sale was one product, fully paid by
assumption, with no document beyond an aggregate "Sales Summary" PDF.
The spec's own schema-naming section also already anticipated
`poultryedos_sale_items` and `poultryedos_payments` as separate tables.

**Confirmed with the user**: build a real multi-item cart (several
products, one client, one combined invoice/receipt), not one-product-
per-sale — the bigger of two options weighed, matching what "POS"
actually implies.

**Schema** (migrations `0030`/`0031`, mirroring the multi-line pattern
already proven for purchase orders in `0024`):
- `poultryedos_sales` is now a header; `poultryedos_sale_items` holds the
  line items (product/quantity/unit/unit_price/discount, with
  `line_total_cents` a generated column so it can never drift). The
  header's `total_amount_cents` is trigger-maintained from the items —
  same shape as `poultryedos_purchase_orders.total_cost_cents` — so every
  existing reader that only ever selected `total_amount_cents`
  (`getFinancialReport`, `getFlockFinance`) needed **zero changes**.
- `poultryedos_payments` is a real ledger against a sale — a balance is
  always **derived** (`total_amount_cents` minus the sum of its
  payments), never stored, the same "derive at read time" convention as
  `biosecurityScore()`/`deriveSubscriptionStatus()`. "Credit" stays a
  valid `payment_method` (what was agreed), but is never a
  `payments.method` value — credit is the absence of a payment, not a
  way of making one.
- `poultryedos_create_sale()` — atomic header + line items + an optional
  first payment, the same "one RPC, one transaction" shape as
  `poultryedos_create_purchase_order`.
- `poultryedos_record_sale_payment()` — records a later payment (e.g.
  settling a credit sale), rejecting an over-payment with a specific,
  friendly message rather than a raw constraint violation (same
  discipline as `0023`/`0027`).
- `poultryedos_quotations`/`poultryedos_quotation_items` — a pre-sale
  offer to an existing customer or a prospect who isn't one yet, same
  multi-line shape as sales. `poultryedos_convert_quotation_to_sale()`
  copies an accepted quotation's items into a real sale rather than
  requiring re-entry, and rejects converting an already-converted,
  declined, or expired quotation.

**The real production tenant already had 2 real sales** — the highest-
risk part of this change. Both were read and snapshotted before the
migration ran; both were confirmed to migrate into `sale_items` with the
exact same figures (`900000`/`68000` cents), and the trigger-recomputed
header total matched the pre-migration stored value exactly. **A second,
smaller real-data issue was then caught and fixed**: those 2 pre-existing
sales had zero payment rows (the ledger didn't exist yet when they were
made), which would have made them appear as fully unpaid invoices even
though their `mpesa` payment method meant they were actually settled at
the time under the old schema's implicit assumption. Migration `0033`
backfills exactly one payment per pre-existing non-credit sale, dated at
the sale's own date — both now correctly show a zero balance.

**PDF/print**: `src/lib/pdf/sale-document.ts` extends the exact same
visual primitives as `simple-report.ts` (header/subtitle/title/"Printed
&lt;date&gt;"/divider/`autoTable`) with a "Bill To" block and a status line —
"Valid until" for a quotation, "Balance due" for an invoice, "Paid in
full" for a receipt — one function, one visual family, so the three
document types are obviously the same kind of thing.

**New**: `/app/pos` (a dedicated checkout screen — cart, customer,
payment, ending in an immediate receipt/invoice download) and
`/app/quotations` (create, download, convert to sale). The Sales page's
"+ New sale" panel got the same cart treatment, plus a balance-aware
document button per sale (Receipt if paid in full, Invoice if not) and
an inline "Record payment" control once a balance remains.

**Live-verified** with two disposable synthetic tenants: a 2-item sale
with a discount, created via `poultryedos_create_sale` with a partial
payment — the derived balance matched exactly; `poultryedos_record_sale_payment`
for the remainder brought the balance to exactly zero; a further
over-payment attempt was rejected with a friendly message (a cosmetic
bug in that message — "KES .00" instead of "KES 0.00" for a zero
balance — was caught here too and fixed in `0032`); cross-tenant RLS
isolation confirmed on all three new tables (sales/sale_items/payments)
— zero rows visible to an unrelated tenant; a quotation created and
converted to a sale, confirming the resulting sale's total matched the
quotation exactly; a second conversion attempt on the same quotation
correctly rejected. All test data and throwaway auth users deleted
afterward. `npx tsc --noEmit`, `npx eslint .`, `npm run build` all clean.

**Not visually verified in this environment**: no real browser is
available in this sandbox (same limitation already noted for other
client-side UI) — the PDF generation code was confirmed to run without
error, but clicking through `/app/pos` and `/app/quotations` for real is
worth doing once this ships.

**A real bug was found exactly this way** — the user clicked through the
new POS screen and reported "quantity has restrictions." The Quantity
input had `min={0.01}` with `step="0.1"`: HTML5's native validation only
accepts values that are `min` plus a whole multiple of `step`, and 0.01
isn't on the 0.1 grid, so the browser silently rejected virtually every
normal quantity (5, 10, 50...) with nothing but a native "please enter a
valid value" tooltip. The exact same mismatch existed in the Purchases
form's quantity field too — introduced earlier this session when its
`min` was raised from `0` to `0.01` to match the database's
`check (quantity > 0)`, without also fixing `step` to match. Fixed in
both places by switching `step` to `"any"`, which keeps the `min=0.01`
floor but drops the step-multiple requirement — this is exactly the kind
of thing manual click-through catches that static analysis can't.

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
- **Cooperatives/aggregators as a distinct concept, contract farming**
  (spec §40/41): a network tenant with many farmers and field officers
  exists now, but there's no separate "cooperative" organization type,
  input-distribution tracking, or contract terms/settlement. The
  **Marketplace (§42) now has a first real slice** — see "Marketplace"
  above — farmer-side listings and public browsing are live; buyer
  accounts, in-app messaging/order matching, contract farming, and the
  cooperative org type remain deferred.
- **Farm-location mapping** (§61's "farm locations"): a farm map needs farm
  GPS coordinates, and nothing in the app has ever captured them —
  `poultryedos_farms.gps_lat/gps_lng` exist in the schema (migration
  `0002`) but no onboarding step, form, or edit UI sets them, and there's
  no farm-profile/edit page at all yet to add that capture to. Field visit
  locations, which *are* captured today, now have a real map — see
  "Maps" below.
- **M-Pesa is architecture-only, not live-tested**: no Safaricom sandbox
  credentials exist in this environment (see the Platform section above).
- **USSD, WhatsApp, real SMS delivery**: the SMS provider interface is
  real and working end-to-end against a console/logging default; no actual
  Kenyan SMS gateway, USSD short-code, or WhatsApp integration exists.
- **Real machine learning (Level 4/5)**: there is no cross-tenant
  historical dataset and no training pipeline, and there's no realistic
  way to build genuine ML in this environment — attempting it would mean
  fabricating exactly what spec §51 forbids. See "AI/ML engine" below for
  what Levels 1-3 actually cover instead.
- **Broiler weight/FCR trajectory prediction**: no weight-capture UI or
  table exists anywhere in the app yet — a prerequisite data-collection
  gap, not an AI limitation.
- **Demand-forecasting "opportunity" signals**: the Decision Center's
  §53 example ("buyer demand increased this week") needs external market
  data this app has no source for; only the tenant's own sales/profit
  trend is used, and only when it's genuinely a signal, not fabricated.
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
- **Phase 7 migrations (`0017`–`0021`) were applied and RLS-verified once
  the Supabase MCP connection came back** (it wasn't available for the
  session that wrote them). Live-verified: `poultryedos_subscription_plans`
  seeded with the 4 plans; the pre-existing tenant backfilled with a trial
  subscription (the auto-create trigger only fires on new tenant inserts,
  so a tenant created before `0017` needed one); a real new tenant created
  as an impersonated `authenticated` user correctly auto-got a trial
  subscription on the starter plan, readable by its owner under RLS; an
  unrelated authenticated user confirmed to see zero rows across
  `poultryedos_subscriptions`/`poultryedos_mpesa_transactions`/
  `poultryedos_sms_logs`/`poultryedos_notifications`/tenant-scoped
  `poultryedos_announcements`; and — the specific attack this schema is
  designed to prevent — a tenant owner inserting their own M-Pesa
  transaction, then trying to mark it `success` themselves, was silently
  a no-op (no RLS policy grants `UPDATE` to any authenticated role; only
  the service-role callback route can transition status). All test data
  cleaned up afterward. **One real bug was caught by Supabase's own
  security advisor and fixed before it could be exploited**:
  `poultryedos_create_trial_subscription()` (migration `0017`) was missing
  the explicit `revoke execute ... from public, anon, authenticated` every
  other `SECURITY DEFINER` trigger function in this schema already has
  (see `0004`/`0005`/`0011`) — without it, `anon` could invoke it directly
  via `/rest/v1/rpc/poultryedos_create_trial_subscription`. Fixed in
  `0021` and confirmed gone from the advisor report afterward.
- **Hard subscription/plan-limit enforcement (migration `0022`/`0023`) was
  live-verified end to end using a fully synthetic, disposable test user**
  (a throwaway `auth.users` row created and deleted purely for this test,
  never a real account — an earlier round of live testing on this
  project's real owner account briefly gave it a second membership and
  surfaced a real duplicate-tenant bug in `getMyMembership()`/
  `getOnboardingState()`, fixed separately; real accounts are off-limits
  for this kind of test from here on): created a tenant, inserted a
  farmer (succeeded, then a second farmer correctly
  rejected — "Your plan allows up to 1 farmers..."), two farms succeeded
  and a third was rejected, a field-officer membership was rejected
  immediately (starter plan's limit is 0), a second team member succeeded
  and a third was rejected. Then set that tenant's subscription to
  `cancelled` and confirmed an insert was blocked by RLS while reads
  stayed fully visible, and confirmed the tenant could still insert an
  M-Pesa transaction to pay and reactivate (no chicken-and-egg lockout).
  Confirmed the real production tenant's actual usage sits comfortably
  within the (slightly loosened) starter limits and its subscription
  reads as active — nothing about this change affects it today. All test
  data and the throwaway auth user were deleted afterward.
- **Multi-line purchase orders (migration `0024`) were live-verified** using
  the same synthetic, disposable test user pattern: a 2-line order (one
  item linked to a tracked inventory item, one not) correctly computed a
  total of both lines' cost; marking it "received" created exactly one
  inventory transaction (only for the tracked line) and moved
  `stock_on_hand` from 0 to the ordered quantity; deleting a line item
  correctly recomputed the header total down; an empty-items order was
  correctly rejected by the RPC; an unrelated user saw zero rows of the
  new `poultryedos_purchase_order_items` table. No new security-advisor
  findings. All test data and the throwaway auth user deleted afterward.
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
- **A real bug was reported and fixed (migration `0027`)**:
  `poultryedos_accept_farmer_invite()` only checked whether the invite's
  *target* row already had a `user_id` — it never checked whether the
  *accepting* account already held a different farmer profile in the same
  tenant, which `poultryedos_farmers_user_idx` (one farmer per user per
  tenant, migration `0002`) rejects outright. Reproduced exactly as
  reported: a tenant owner opened an invite meant for a farmer they'd just
  added while still logged into their own account, and got a raw
  `duplicate key value violates unique constraint
  "poultryedos_farmers_user_idx"` error. Fixed by checking for this case
  explicitly before the update and raising a specific, readable error
  (`already_a_farmer_in_tenant`) instead; the invite itself is untouched
  and stays valid for the actual invitee.
- **Another real bug was reported and fixed**: Expenses and Sales had no
  batch selector at all — every entry was silently assigned to whichever
  flock `getMyFarmerContext()` treated as "current" (the most recently
  placed active one), so a farm running more than one concurrent batch
  could have entries land on the wrong batch with no way to notice or
  correct it. A live, read-only query against the real database confirmed
  this had already happened on the production tenant: an expense and a
  sale were split across two batches purely by flock creation order, not
  by the owner's actual choice. Fixed by adding a Batch selector to both
  log forms, showing each entry's real batch in the list (embedding
  `poultryedos_flocks.batch_code`), and adding a shared inline
  `BatchReassign` control so the two already-misattributed records can be
  corrected once the owner confirms where they actually belong — they
  were deliberately **not** auto-corrected, since guessing intent would
  risk being wrong. Also fixed a related bug in the same pages: the Sales
  page's "quick daily total" only summed `context.flock`'s daily records,
  undercounting any multi-flock farm's actual sales; it now sums across
  every flock on the farm. `npx tsc --noEmit`, `npx eslint .`, and
  `npm run build` all clean.
- **A related bug was found while sweeping for the same class of issue**:
  `ensureDueNotifications()` only ever checked `farmerContext.flock` — the
  same single "most recently placed active flock" default that caused the
  batch-misattribution bug above. On a farm running more than one
  concurrent batch, every flock except that one silently got no
  vaccination-due reminder, no mortality alert, and no production-decline
  warning, with nothing to indicate anything was being skipped. Fixed by
  looping over every active flock on the farm (via `getAllFlocks`)
  instead of just the default one; dedupe keys already include
  `flock.id`, so this doesn't risk duplicate notifications.
  `npx tsc --noEmit`, `npx eslint .`, `npm run build` all clean.
