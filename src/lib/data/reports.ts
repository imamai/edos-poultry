import { createClient } from "@/lib/supabase/server";

export interface ReportRange {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
  label: string;
}

export function lastNDaysRange(days: number): ReportRange {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    label: `Last ${days} days`,
  };
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function customRange(from: string, to: string): ReportRange {
  return { from, to, label: `${formatShortDate(from)} – ${formatShortDate(to)}` };
}

export interface TenantFlockOption {
  id: string;
  batchCode: string;
  status: string;
  initialQuantity: number;
  currentQuantity: number;
}

/** Tenant-wide flock list (across every farm in the tenant), for the
 * Reports batch selector -- Reports is already the network-wide rollup
 * an owner/admin/farm_manager uses, as opposed to the single-farm
 * getAllFlocks(farmId) used elsewhere. */
export async function getAllTenantFlocks(tenantId: string): Promise<TenantFlockOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_flocks")
    .select("id, batch_code, status, initial_quantity, current_quantity")
    .eq("tenant_id", tenantId)
    .order("placement_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    batchCode: f.batch_code,
    status: f.status,
    initialQuantity: f.initial_quantity,
    currentQuantity: f.current_quantity,
  }));
}

export interface ProductionReportRow {
  date: string;
  eggs: number;
  feedKg: number;
  mortality: number;
}

export interface ProductionReport {
  rows: ProductionReportRow[];
  totalEggs: number;
  totalFeedKg: number;
  totalMortality: number;
  /** kg of feed per dozen eggs -- well-defined even aggregated across
   * several batches (unlike grams/bird/day, which needs one definite
   * bird count). null when there's no egg data yet to divide by. */
  feedPerDozenEggsKg: number | null;
}

/** Tenant-wide (or one batch, when flockId is given), date-ranged
 * production totals — the multi-flock rollup a network admin needs, as
 * opposed to the single-flock view already on /app/flock/[id].
 * Aggregated in JS from one bounded, date-filtered query (same pattern
 * as getNetworkSummary), never loading unbounded history. */
export async function getProductionReport(tenantId: string, range: ReportRange, flockId?: string): Promise<ProductionReport> {
  const supabase = await createClient();
  let query = supabase
    .from("poultryedos_daily_records")
    .select("record_date, eggs_collected, feed_consumed_kg, mortality")
    .eq("tenant_id", tenantId)
    .gte("record_date", range.from)
    .lte("record_date", range.to)
    .order("record_date");
  if (flockId) query = query.eq("flock_id", flockId);
  const { data, error } = await query;
  if (error) throw error;

  const byDate = new Map<string, ProductionReportRow>();
  for (const r of data ?? []) {
    const row = byDate.get(r.record_date) ?? { date: r.record_date, eggs: 0, feedKg: 0, mortality: 0 };
    row.eggs += r.eggs_collected ?? 0;
    row.feedKg += r.feed_consumed_kg ?? 0;
    row.mortality += r.mortality ?? 0;
    byDate.set(r.record_date, row);
  }

  const rows = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  const totalEggs = rows.reduce((s, r) => s + r.eggs, 0);
  const totalFeedKg = rows.reduce((s, r) => s + r.feedKg, 0);
  return {
    rows,
    totalEggs,
    totalFeedKg,
    totalMortality: rows.reduce((s, r) => s + r.mortality, 0),
    feedPerDozenEggsKg: totalEggs > 0 ? totalFeedKg / (totalEggs / 12) : null,
  };
}

export interface MortalityReportRow {
  batchCode: string;
  flockId: string;
  mortality: number;
  currentQuantity: number;
}

export interface MortalityReport {
  rows: MortalityReportRow[];
  totalMortality: number;
}

export async function getMortalityReport(tenantId: string, range: ReportRange, flockId?: string): Promise<MortalityReport> {
  const supabase = await createClient();
  let recordsQuery = supabase
    .from("poultryedos_daily_records")
    .select("flock_id, mortality")
    .eq("tenant_id", tenantId)
    .gte("record_date", range.from)
    .lte("record_date", range.to);
  if (flockId) recordsQuery = recordsQuery.eq("flock_id", flockId);

  let flocksQuery = supabase.from("poultryedos_flocks").select("id, batch_code, current_quantity").eq("tenant_id", tenantId);
  if (flockId) flocksQuery = flocksQuery.eq("id", flockId);

  const [{ data: records, error }, { data: flocks }] = await Promise.all([recordsQuery, flocksQuery]);
  if (error) throw error;

  const byFlock = new Map<string, number>();
  for (const r of records ?? []) {
    byFlock.set(r.flock_id, (byFlock.get(r.flock_id) ?? 0) + (r.mortality ?? 0));
  }

  const rows: MortalityReportRow[] = (flocks ?? [])
    .filter((f) => byFlock.has(f.id))
    .map((f) => ({
      batchCode: f.batch_code,
      flockId: f.id,
      mortality: byFlock.get(f.id) ?? 0,
      currentQuantity: f.current_quantity,
    }))
    .sort((a, b) => b.mortality - a.mortality);

  return { rows, totalMortality: rows.reduce((s, r) => s + r.mortality, 0) };
}

export interface FinancialReportCategoryRow {
  category: string;
  amountCents: number;
}

export interface FinancialReportCustomerRow {
  customerName: string;
  amountCents: number;
}

export interface FinancialReport {
  revenueCents: number;
  expensesCents: number;
  profitCents: number;
  expensesByCategory: FinancialReportCategoryRow[];
  /** Mirrors expensesByCategory on the revenue side (missing entirely
   * before) -- includes an explicit "Quick daily sales" bucket for the
   * unattributed Record Today total, so this always sums back to
   * revenueCents exactly rather than silently omitting it. */
  revenueByProduct: FinancialReportCategoryRow[];
  /** Real, named customers only (a walk-in/no-customer sale has nothing
   * to rank) -- doesn't sum to revenueCents by design. */
  topCustomers: FinancialReportCustomerRow[];
}

export async function getFinancialReport(tenantId: string, range: ReportRange, flockId?: string): Promise<FinancialReport> {
  const supabase = await createClient();

  let recordsQuery = supabase
    .from("poultryedos_daily_records")
    .select("sales_amount_cents")
    .eq("tenant_id", tenantId)
    .gte("record_date", range.from)
    .lte("record_date", range.to);
  if (flockId) recordsQuery = recordsQuery.eq("flock_id", flockId);

  let salesQuery = supabase
    .from("poultryedos_sales")
    .select("total_amount_cents, customer_id, poultryedos_customers(name), poultryedos_sale_items(product, line_total_cents)")
    .eq("tenant_id", tenantId)
    .gte("sale_date", range.from)
    .lte("sale_date", range.to);
  if (flockId) salesQuery = salesQuery.eq("flock_id", flockId);

  let expensesQuery = supabase
    .from("poultryedos_expenses")
    .select("amount_cents, poultryedos_expense_categories(name)")
    .eq("tenant_id", tenantId)
    .gte("expense_date", range.from)
    .lte("expense_date", range.to);
  if (flockId) expensesQuery = expensesQuery.eq("flock_id", flockId);

  const [{ data: records }, { data: sales }, { data: expenses }] = await Promise.all([recordsQuery, salesQuery, expensesQuery]);

  const quickSalesCents = (records ?? []).reduce((s, r) => s + (r.sales_amount_cents ?? 0), 0);
  const itemizedSalesCents = (sales ?? []).reduce((s, r) => s + (r.total_amount_cents ?? 0), 0);
  const revenueCents = quickSalesCents + itemizedSalesCents;

  const salesRows = (sales ?? []) as unknown as {
    total_amount_cents: number;
    customer_id: string | null;
    poultryedos_customers: { name: string } | null;
    poultryedos_sale_items: { product: string; line_total_cents: number }[];
  }[];

  const byProduct = new Map<string, number>();
  for (const s of salesRows) {
    for (const item of s.poultryedos_sale_items ?? []) {
      byProduct.set(item.product, (byProduct.get(item.product) ?? 0) + item.line_total_cents);
    }
  }
  const revenueByProduct = [...byProduct.entries()].map(([category, amountCents]) => ({ category, amountCents }));
  if (quickSalesCents > 0) revenueByProduct.push({ category: "Quick daily sales (unattributed)", amountCents: quickSalesCents });
  revenueByProduct.sort((a, b) => b.amountCents - a.amountCents);

  const byCustomer = new Map<string, number>();
  for (const s of salesRows) {
    if (!s.customer_id || !s.poultryedos_customers) continue;
    const name = s.poultryedos_customers.name;
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + s.total_amount_cents);
  }
  const topCustomers = [...byCustomer.entries()]
    .map(([customerName, amountCents]) => ({ customerName, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 5);

  const byCategory = new Map<string, number>();
  for (const e of (expenses ?? []) as unknown as { amount_cents: number; poultryedos_expense_categories: { name: string } | null }[]) {
    const name = e.poultryedos_expense_categories?.name ?? "Uncategorized";
    byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount_cents);
  }
  const expensesByCategory = [...byCategory.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const expensesCents = expensesByCategory.reduce((s, r) => s + r.amountCents, 0);

  return {
    revenueCents,
    expensesCents,
    profitCents: revenueCents - expensesCents,
    expensesByCategory,
    revenueByProduct,
    topCustomers,
  };
}
