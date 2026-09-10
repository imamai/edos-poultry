import { createClient } from "@/lib/supabase/server";
import type { Farmer, FarmerInvite, FieldTask, FieldVisit } from "@/lib/database.types";

export async function getFarmersWithFarmCount(
  tenantId: string,
): Promise<(Farmer & { farm_count: number })[]> {
  const supabase = await createClient();
  const { data: farmers, error } = await supabase
    .from("poultryedos_farmers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (error) throw error;

  const { data: farms } = await supabase
    .from("poultryedos_farms")
    .select("farmer_id")
    .eq("tenant_id", tenantId);

  const counts = new Map<string, number>();
  for (const f of farms ?? []) {
    counts.set(f.farmer_id, (counts.get(f.farmer_id) ?? 0) + 1);
  }

  return (farmers ?? []).map((f) => ({ ...(f as Farmer), farm_count: counts.get(f.id) ?? 0 }));
}

export async function getPendingInvites(tenantId: string): Promise<FarmerInvite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_farmer_invites")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FarmerInvite[];
}

export interface NetworkSummary {
  farmerCount: number;
  farmCount: number;
  flockCount: number;
  totalBirds: number;
  mortality7d: number;
  eggs7d: number;
  sales7dCents: number;
  expenses7dCents: number;
}

export async function getNetworkSummary(tenantId: string): Promise<NetworkSummary> {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ count: farmerCount }, { count: farmCount }, flocksRes, recordsRes, salesRes, expensesRes] =
    await Promise.all([
      supabase.from("poultryedos_farmers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("poultryedos_farms").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("poultryedos_flocks").select("current_quantity").eq("tenant_id", tenantId).eq("status", "active"),
      supabase
        .from("poultryedos_daily_records")
        .select("mortality, eggs_collected, sales_amount_cents")
        .eq("tenant_id", tenantId)
        .gte("record_date", sevenDaysAgo),
      supabase.from("poultryedos_sales").select("total_amount_cents").eq("tenant_id", tenantId).gte("sale_date", sevenDaysAgo),
      supabase.from("poultryedos_expenses").select("amount_cents").eq("tenant_id", tenantId).gte("expense_date", sevenDaysAgo),
    ]);

  const flocks = flocksRes.data ?? [];
  const records = recordsRes.data ?? [];
  const sales = salesRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  return {
    farmerCount: farmerCount ?? 0,
    farmCount: farmCount ?? 0,
    flockCount: flocks.length,
    totalBirds: flocks.reduce((sum, f) => sum + f.current_quantity, 0),
    mortality7d: records.reduce((sum, r) => sum + (r.mortality ?? 0), 0),
    eggs7d: records.reduce((sum, r) => sum + (r.eggs_collected ?? 0), 0),
    sales7dCents:
      records.reduce((sum, r) => sum + (r.sales_amount_cents ?? 0), 0) +
      sales.reduce((sum, s) => sum + (s.total_amount_cents ?? 0), 0),
    expenses7dCents: expenses.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0),
  };
}

export async function getAssignedFarmers(
  fieldOfficerUserId: string,
): Promise<(Farmer & { farm_count: number })[]> {
  const supabase = await createClient();
  const { data: assignments, error } = await supabase
    .from("poultryedos_field_assignments")
    .select("farmer_id, poultryedos_farmers(*)")
    .eq("field_officer_user_id", fieldOfficerUserId);
  if (error) throw error;

  const farmerIds = (assignments ?? []).map((a) => a.farmer_id);
  const { data: farms } = farmerIds.length
    ? await supabase.from("poultryedos_farms").select("farmer_id").in("farmer_id", farmerIds)
    : { data: [] };

  const counts = new Map<string, number>();
  for (const f of farms ?? []) counts.set(f.farmer_id, (counts.get(f.farmer_id) ?? 0) + 1);

  return (assignments ?? [])
    .map((a) => a.poultryedos_farmers as unknown as Farmer)
    .filter(Boolean)
    .map((f) => ({ ...f, farm_count: counts.get(f.id) ?? 0 }));
}

export async function getFieldVisits(
  filter: { fieldOfficerUserId?: string; tenantId?: string },
): Promise<(FieldVisit & { poultryedos_farmers: { full_name: string } | null })[]> {
  const supabase = await createClient();
  let query = supabase
    .from("poultryedos_field_visits")
    .select("*, poultryedos_farmers(full_name)")
    .order("scheduled_date", { ascending: false });

  if (filter.fieldOfficerUserId) query = query.eq("field_officer_user_id", filter.fieldOfficerUserId);
  if (filter.tenantId) query = query.eq("tenant_id", filter.tenantId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as (FieldVisit & { poultryedos_farmers: { full_name: string } | null })[];
}

export async function getMyTasks(
  userId: string,
): Promise<(FieldTask & { poultryedos_farmers: { full_name: string } | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_field_tasks")
    .select("*, poultryedos_farmers(full_name)")
    .eq("assigned_to", userId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as (FieldTask & { poultryedos_farmers: { full_name: string } | null })[];
}

export async function getAllTenantTasks(
  tenantId: string,
): Promise<(FieldTask & { poultryedos_farmers: { full_name: string } | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_field_tasks")
    .select("*, poultryedos_farmers(full_name)")
    .eq("tenant_id", tenantId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as (FieldTask & { poultryedos_farmers: { full_name: string } | null })[];
}

export interface TenantMemberWithEmail {
  user_id: string;
  email: string;
  role: string;
  status: string;
}

export async function getTenantMembers(tenantId: string): Promise<TenantMemberWithEmail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("poultryedos_list_tenant_members", { p_tenant_id: tenantId });
  if (error) throw error;
  return (data ?? []) as TenantMemberWithEmail[];
}

export async function getFieldOfficers(tenantId: string): Promise<TenantMemberWithEmail[]> {
  const members = await getTenantMembers(tenantId);
  return members.filter((m) => m.role === "field_officer");
}
