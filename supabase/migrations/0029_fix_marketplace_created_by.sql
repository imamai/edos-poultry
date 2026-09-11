-- EDOS Poultry360: fix poultryedos_marketplace_listings.created_by.
--
-- Caught during live verification of migration 0028, before any real
-- listing was ever created: created_by was `not null` with `on delete
-- cascade` and nothing in the app (or this migration) ever populates it
-- on insert, so every real insert from MarketplaceManager would have
-- failed with a not-null violation. Every other created_by column in
-- this schema (poultryedos_expenses, poultryedos_daily_records) is
-- nullable with `on delete set null` -- matching that actual convention
-- rather than inventing a new one.

alter table public.poultryedos_marketplace_listings
  alter column created_by drop not null;

alter table public.poultryedos_marketplace_listings
  drop constraint poultryedos_marketplace_listings_created_by_fkey,
  add constraint poultryedos_marketplace_listings_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;
