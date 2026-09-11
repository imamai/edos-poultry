import { createClient } from "@/lib/supabase/server";
import type { Quotation, QuotationItem } from "@/lib/database.types";

export type QuotationWithItems = Quotation & {
  poultryedos_customers: { name: string; phone: string | null } | null;
  poultryedos_quotation_items: QuotationItem[];
};

export async function getQuotations(tenantId: string): Promise<QuotationWithItems[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_quotations")
    .select("*, poultryedos_customers(name, phone), poultryedos_quotation_items(*)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as QuotationWithItems[];
}
