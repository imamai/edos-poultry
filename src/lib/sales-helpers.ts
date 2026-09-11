import type { Sale, SaleItem, Payment } from "@/lib/database.types";

/** Pure, server-free helpers over a sale + its embedded relations -- kept
 * out of src/lib/data/business.ts (which imports the server-only Supabase
 * client) so client components like SalesManager can use them without
 * pulling next/headers into the browser bundle. */
export type SaleWithDetails = Sale & {
  poultryedos_customers: { name: string; phone: string | null } | null;
  poultryedos_flocks: { batch_code: string } | null;
  poultryedos_sale_items: SaleItem[];
  poultryedos_payments: Pick<Payment, "amount_cents">[];
};

/** A sale's balance is always derived, never stored (migration 0030) --
 * same "derive at read time" convention as biosecurityScore()/
 * deriveSubscriptionStatus(). Zero or negative means fully paid. */
export function saleBalanceCents(sale: Pick<SaleWithDetails, "total_amount_cents" | "poultryedos_payments">): number {
  return sale.total_amount_cents - saleAmountPaidCents(sale);
}

export function saleAmountPaidCents(sale: Pick<SaleWithDetails, "poultryedos_payments">): number {
  return sale.poultryedos_payments.reduce((sum, p) => sum + p.amount_cents, 0);
}
