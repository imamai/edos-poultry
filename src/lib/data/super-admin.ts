import { createClient } from "@/lib/supabase/server";

// EDOS Poultry360: cross-tenant super admin (spec §5/67). Every function
// here is a thin wrapper over a SECURITY DEFINER RPC that checks the
// poultryedos_super_admins allowlist itself (see migration 0026) — no
// base table's RLS was loosened to support this.

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("poultryedos_is_super_admin");
  return Boolean(data);
}

export interface SuperAdminTenantRow {
  tenant_id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  created_at: string;
  subscription_status: string | null;
  plan_name: string | null;
  farmer_count: number;
  farm_count: number;
  flock_count: number;
}

export async function listAllTenants(): Promise<SuperAdminTenantRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("poultryedos_super_admin_list_tenants");
  if (error) throw error;
  return (data ?? []) as SuperAdminTenantRow[];
}

// Suspend/reactivate is a write triggered from the dashboard's client
// component, which calls poultryedos_super_admin_set_tenant_status
// directly via the client-side Supabase client — the same pattern every
// other write in this app follows (see SuperAdminDashboard).
