import { createClient } from "@/lib/supabase/server";
import type {
  Customer,
  Expense,
  ExpenseCategory,
  HealthEvent,
  InventoryItem,
  PurchaseOrder,
  PurchaseOrderItem,
  BiosecurityCheck,
  Sale,
  Supplier,
} from "@/lib/database.types";

export async function getExpenseCategories(tenantId: string): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_expense_categories")
    .select("*")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExpenseCategory[];
}

export async function getRecentExpenses(
  tenantId: string,
  limit = 30,
): Promise<(Expense & { poultryedos_expense_categories: { name: string } | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_expenses")
    .select("*, poultryedos_expense_categories(name)")
    .eq("tenant_id", tenantId)
    .order("expense_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as (Expense & { poultryedos_expense_categories: { name: string } | null })[];
}

export async function getCustomers(tenantId: string): Promise<Customer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function getRecentSales(
  tenantId: string,
  limit = 30,
): Promise<(Sale & { poultryedos_customers: { name: string; phone: string | null } | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_sales")
    .select("*, poultryedos_customers(name, phone)")
    .eq("tenant_id", tenantId)
    .order("sale_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as (Sale & {
    poultryedos_customers: { name: string; phone: string | null } | null;
  })[];
}

export async function getInventoryItems(tenantId: string): Promise<InventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_inventory_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as InventoryItem[];
}

export async function getSuppliers(tenantId: string): Promise<Supplier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_suppliers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export type PurchaseOrderWithDetails = PurchaseOrder & {
  poultryedos_suppliers: { name: string } | null;
  poultryedos_purchase_order_items: PurchaseOrderItem[];
};

export async function getRecentPurchaseOrders(tenantId: string, limit = 20): Promise<PurchaseOrderWithDetails[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_purchase_orders")
    .select("*, poultryedos_suppliers(name), poultryedos_purchase_order_items(*)")
    .eq("tenant_id", tenantId)
    .order("order_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PurchaseOrderWithDetails[];
}

export async function getHealthEvents(flockId: string): Promise<HealthEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_health_events")
    .select("*")
    .eq("flock_id", flockId)
    .order("event_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HealthEvent[];
}

export async function getBiosecurityChecks(farmId: string, limit = 14): Promise<BiosecurityCheck[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_biosecurity_checks")
    .select("*")
    .eq("farm_id", farmId)
    .order("check_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BiosecurityCheck[];
}

export interface FlockFinance {
  revenueQuickSalesCents: number;
  revenueItemizedSalesCents: number;
  totalRevenueCents: number;
  totalExpensesCents: number;
  profitCents: number;
  birdsSoldOrLost: number;
  totalMortality: number;
}

export async function getFlockFinance(flockId: string): Promise<FlockFinance> {
  const supabase = await createClient();

  const [{ data: records }, { data: sales }, { data: expenses }] = await Promise.all([
    supabase.from("poultryedos_daily_records").select("sales_amount_cents, mortality, birds_sold").eq("flock_id", flockId),
    supabase.from("poultryedos_sales").select("total_amount_cents").eq("flock_id", flockId),
    supabase.from("poultryedos_expenses").select("amount_cents").eq("flock_id", flockId),
  ]);

  const revenueQuickSalesCents = (records ?? []).reduce((sum, r) => sum + (r.sales_amount_cents ?? 0), 0);
  const revenueItemizedSalesCents = (sales ?? []).reduce((sum, s) => sum + (s.total_amount_cents ?? 0), 0);
  const totalExpensesCents = (expenses ?? []).reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);
  const totalMortality = (records ?? []).reduce((sum, r) => sum + (r.mortality ?? 0), 0);
  const birdsSoldOrLost = (records ?? []).reduce((sum, r) => sum + (r.mortality ?? 0) + (r.birds_sold ?? 0), 0);

  const totalRevenueCents = revenueQuickSalesCents + revenueItemizedSalesCents;

  return {
    revenueQuickSalesCents,
    revenueItemizedSalesCents,
    totalRevenueCents,
    totalExpensesCents,
    profitCents: totalRevenueCents - totalExpensesCents,
    birdsSoldOrLost,
    totalMortality,
  };
}
