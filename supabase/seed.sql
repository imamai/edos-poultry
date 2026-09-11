-- Global reference data: poultry types and a handful of knowledge base
-- articles, available to every tenant (tenant_id is null = global).
-- Idempotent: safe to re-run.

insert into poultryedos_expense_categories (tenant_id, name) values
  (null, 'Chicks'), (null, 'Feed'), (null, 'Vaccines'), (null, 'Medicine'),
  (null, 'Labour'), (null, 'Transport'), (null, 'Electricity'), (null, 'Water'),
  (null, 'Rent'), (null, 'Equipment'), (null, 'Repairs'),
  (null, 'Veterinary services'), (null, 'Packaging'), (null, 'Marketing'), (null, 'Other')
on conflict (name) where tenant_id is null do nothing;

insert into poultryedos_poultry_types (tenant_id, name, code) values
  (null, 'Layers', 'LAYER'),
  (null, 'Broilers', 'BROILER'),
  (null, 'Kienyeji / Indigenous', 'KIENYEJI'),
  (null, 'Breeders', 'BREEDER'),
  (null, 'Chicks', 'CHICK'),
  (null, 'Pullets', 'PULLET'),
  (null, 'Mixed', 'MIXED')
on conflict (code) where tenant_id is null do nothing;

insert into poultryedos_knowledge_base (tenant_id, title, category, poultry_type_scope, body) values
(null, 'Brooding chicks in the first two weeks', 'brooding', 'chick',
 'Keep day-old chicks in a draft-free brooder at around 32-35°C for the first week, lowering by about 2-3°C per week as they feather out. Watch chick behavior, not just the thermometer: chicks huddled tightly and chirping loudly are usually cold; chicks spread far from the heat source, panting, are usually too warm. Provide clean water and a starter feed from the first hours, and make sure every chick can reach both easily. Keep stocking density low enough that chicks are not piling on each other.'),

(null, 'Feeding layers for consistent egg production', 'feeding', 'layer',
 'Match feed to production stage: growers need a balanced grower ration, while birds approaching point-of-lay should move to a layer ration with adequate calcium for shell formation. Feed at consistent times each day, and keep feeders clean and free of mold. A sudden, unexplained drop in feed intake is usually worth investigating before it shows up as a drop in egg numbers — check feed quality, water availability, heat stress, and house crowding first.'),

(null, 'Building a basic vaccination routine', 'vaccination', null,
 'Work with your local veterinary or extension officer to set a vaccination schedule appropriate for the diseases common in your area and your poultry type. Keep a written record of every vaccine given, the date, and the batch it was given to — this record is what lets you spot a genuinely missed vaccination rather than guessing. Store vaccines exactly as their label instructs (many require refrigeration) and never use a vaccine past its expiry date.'),

(null, 'Everyday biosecurity that actually gets followed', 'biosecurity', null,
 'The biosecurity habits that protect a flock are usually simple, repeated ones: a footbath at the house entrance that is actually kept full and changed regularly, visitors and family members washing hands before and after handling birds, dead birds removed and disposed of promptly rather than left in the house, and feed stored where rodents and wild birds cannot reach it. Consistency matters more than complexity — a simple routine followed every day beats an elaborate one followed occasionally.'),

(null, 'Recognizing when mortality needs a closer look', 'disease_warning_signs', null,
 'Every flock has some baseline mortality, and it varies by age and poultry type. What matters is a change: several birds dying in a day when the flock has been stable, birds going off feed and water together, or a sudden drop in egg production alongside unwell-looking birds. None of these on their own tell you exactly what is wrong — but together they are a clear signal to isolate affected birds where practical, record what you are observing, and contact a veterinary professional rather than guessing at treatment.'),

(null, 'Simple record keeping that pays for itself', 'record_keeping', null,
 'The single most useful habit in poultry farming is writing down the same few numbers every day: birds alive, deaths, eggs collected, feed used, and money in from sales. On their own each number tells you little, but a week or two of consistent records lets you see trends you would otherwise miss — a slow decline in eggs, feed use creeping up without more birds to justify it, or mortality that is quietly higher than it used to be. Consistent daily records, even simple ones, are worth more than an occasional detailed one.')
;

-- Subscription plans (spec §45). Limits are a resource -> max-count map; a
-- missing key means "unlimited" for that resource (see
-- src/lib/data/subscriptions.ts). Prices are illustrative placeholders, not
-- real pricing decisions — an admin UI to edit these doesn't exist yet
-- (no super-admin role), so change them here and re-run this file.
insert into poultryedos_subscription_plans (code, name, price_cents, billing_interval, limits, sort_order) values
  ('starter', 'Starter', 0, 'monthly',
   -- farmers stays at 1 (that's the definition of this individual/starter
   -- tier); the rest were loosened in migration 0022 to give a real
   -- smallholder realistic headroom (multiple concurrent flocks/houses is
   -- normal) before hard enforcement blocks a write — keep this literal in
   -- sync with that migration so re-running this file can't regress it.
   '{"farmers": 1, "farms": 2, "houses": 5, "flocks": 5, "users": 2, "field_officers": 0}'::jsonb, 1),
  ('growth', 'Growth', 150000, 'monthly',
   '{"farmers": 10, "farms": 10, "houses": 30, "flocks": 30, "users": 5, "field_officers": 2}'::jsonb, 2),
  ('professional', 'Professional', 450000, 'monthly',
   '{"farmers": 100, "farms": 150, "houses": 500, "flocks": 500, "users": 20, "field_officers": 10}'::jsonb, 3),
  ('enterprise', 'Enterprise', 1500000, 'monthly', '{}'::jsonb, 4)
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  billing_interval = excluded.billing_interval,
  limits = excluded.limits,
  sort_order = excluded.sort_order;
