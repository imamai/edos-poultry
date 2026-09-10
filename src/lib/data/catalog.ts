import { createClient } from "@/lib/supabase/server";
import type { PoultryType } from "@/lib/database.types";

export async function getPoultryTypes(tenantId: string): Promise<PoultryType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_poultry_types")
    .select("*")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as PoultryType[];
}
