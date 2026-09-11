import { createClient } from "@/lib/supabase/server";
import type { MarketplaceBrowseRow, MarketplaceCategory, MarketplaceListing } from "@/lib/database.types";

/** A tenant's own listings, for the "My listings" manage view -- writes
 * against this table go straight through the client-side Supabase client
 * (see MarketplaceManager), same as every other manager component. */
export async function getMyListings(tenantId: string): Promise<(MarketplaceListing & { poultryedos_flocks: { batch_code: string } | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_marketplace_listings")
    .select("*, poultryedos_flocks(batch_code)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (MarketplaceListing & { poultryedos_flocks: { batch_code: string } | null })[];
}

/** The public board -- works for a signed-in tenant member and for a
 * signed-out visitor alike, since poultryedos_marketplace_browse() is
 * granted to both anon and authenticated (migration 0028). */
export async function browseListings(category?: MarketplaceCategory): Promise<MarketplaceBrowseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("poultryedos_marketplace_browse", { p_category: category ?? null });
  if (error) throw error;
  return (data ?? []) as MarketplaceBrowseRow[];
}
