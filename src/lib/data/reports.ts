import { createClient } from "@/lib/supabase/server";

export interface ReportRange {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
  label: string;
}

export function lastNDaysRange(days: 7 | 30 | 90): ReportRange {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    label: `Last ${days} days`,
  };
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
}

/** Tenant-wide, date-ranged production totals — the multi-flock rollup a
 * network admin needs, as opposed to the single-flock view already on
 * /app/flock/[id]. Aggregated in JS from one bounded, date-filtered query
 * (same pattern as getNetworkSummary), never loading unbounded history. */
export async function getProductionReport(tenantId: string, range: ReportRange): Promise<ProductionReport> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_daily_records")
    .select("record_date, eggs_collected, feed_consumed_kg, mortality")
    .eq("tenant_id", tenantId)
    .gte("record_date", range.from)
    .lte("record_date", range.to)
    .order("record_date");
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
  return {
    rows,
    totalEggs: rows.reduce((s, r) => s + r.eggs, 0),
    totalFeedKg: rows.reduce((s, r) => s + r.feedKg, 0),
    totalMortality: rows.reduce((s, r) => s + r.mortality, 0),
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

export async function getMortalityReport(tenantId: string, range: ReportRange): Promise<MortalityReport> {
  const supabase = await createClient();
  const [{ data: records, error }, { data: flocks }] = await Promise.all([
    supabase
      .from("poultryedos_daily_records")
      .select("flock_id, mortality")
      .eq("tenant_id", tenantId)
      .gte("record_date", range.from)
      .lte("record_date", range.to),
    supabase.from("poultryedos_flocks").select("id, batch_code, current_quantity").eq("tenant_id", tenantId),
  ]);
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

export interface FinancialReport {
  revenueCents: number;
  expensesCents: number;
  profitCents: number;
  expensesByCategory: FinancialReportCategoryRow[];
}

export async function getFinancialReport(tenantId: string, range: ReportRange): Promise<FinancialReport> {
  const supabase = await createClient();
  const [{ data: records }, { data: sales }, { data: expenses }] = await Promise.all([
    supabase
      .from("poultryedos_daily_records")
      .select("sales_amount_cents")
      .eq("tenant_id", tenantId)
      .gte("record_date", range.from)
      .lte("record_date", range.to),
    supabase
      .from("poultryedos_sales")
      .select("total_amount_cents")
      .eq("tenant_id", tenantId)
      .gte("sale_date", range.from)
      .lte("sale_date", range.to),
    supabase
      .from("poultryedos_expenses")
      .select("amount_cents, poultryedos_expense_categories(name)")
      .eq("tenant_id", tenantId)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to),
  ]);

  const revenueCents =
    (records ?? []).reduce((s, r) => s + (r.sales_amount_cents ?? 0), 0) +
    (sales ?? []).reduce((s, r) => s + (r.total_amount_cents ?? 0), 0);

  const byCategory = new Map<string, number>();
  for (const e of (expenses ?? []) as unknown as { amount_cents: number; poultryedos_expense_categories: { name: string } | null }[]) {
    const name = e.poultryedos_expense_categories?.name ?? "Uncategorized";
    byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount_cents);
  }
  const expensesByCategory = [...byCategory.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const expensesCents = expensesByCategory.reduce((s, r) => s + r.amountCents, 0);

  return { revenueCents, expensesCents, profitCents: revenueCents - expensesCents, expensesByCategory };
}
