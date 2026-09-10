import { createClient } from "@/lib/supabase/server";
import type { Farm, Farmer, Flock, House, Tenant } from "@/lib/database.types";

export interface OnboardingState {
  tenant: Tenant | null;
  farmer: Farmer | null;
  farm: Farm | null;
  house: House | null;
  flock: Flock | null;
}

/** Figures out how far a signed-in user has gotten through onboarding, so the
 * wizard can resume at the right step instead of losing partial progress. */
export async function getOnboardingState(): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const empty: OnboardingState = { tenant: null, farmer: null, farm: null, house: null, flock: null };
  if (!user) return empty;

  const { data: membership } = await supabase
    .from("poultryedos_tenant_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return empty;

  const { data: tenant } = await supabase
    .from("poultryedos_tenants")
    .select("*")
    .eq("id", membership.tenant_id)
    .maybeSingle();

  const { data: farmer } = await supabase
    .from("poultryedos_farmers")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!farmer) return { ...empty, tenant: tenant as Tenant };

  const { data: farm } = await supabase
    .from("poultryedos_farms")
    .select("*")
    .eq("farmer_id", farmer.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!farm) return { ...empty, tenant: tenant as Tenant, farmer: farmer as Farmer };

  const { data: house } = await supabase
    .from("poultryedos_houses")
    .select("*")
    .eq("farm_id", farm.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: flock } = await supabase
    .from("poultryedos_flocks")
    .select("*")
    .eq("farm_id", farm.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return {
    tenant: tenant as Tenant,
    farmer: farmer as Farmer,
    farm: farm as Farm,
    house: (house as House) ?? null,
    flock: (flock as Flock) ?? null,
  };
}
