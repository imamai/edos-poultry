import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DailyRecord, Farm, Farmer, Flock, MembershipRole, Tenant, VaccinationSchedule } from "@/lib/database.types";

export interface FarmerContext {
  tenant: Tenant;
  farmer: Farmer;
  farm: Farm;
  flock: Flock | null;
}

export interface MembershipContext {
  userId: string;
  tenant: Tenant;
  role: MembershipRole;
}

/** The bare membership check, with NO requirement that the user also has
 * their own farmer/farm/flock. Owners/admins running a cooperative and
 * field officers visiting other people's farms both hit this path — they
 * are real tenant members without being a farmer themselves. */
export const getMyMembership = cache(async (): Promise<MembershipContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // The schema allows one user to hold active memberships in more than one
  // tenant (a consultant who owns their own farm and also field-officers
  // for someone else's, say) — order + limit(1) picks a deterministic one
  // (the oldest) instead of .maybeSingle(), which silently returns null
  // (not an error this code checked) the moment there's more than one row,
  // incorrectly routing an already-onboarded user back to /onboarding.
  const { data: membership } = await supabase
    .from("poultryedos_tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const { data: tenant } = await supabase
    .from("poultryedos_tenants")
    .select("*")
    .eq("id", membership.tenant_id)
    .maybeSingle();
  if (!tenant) return null;

  return { userId: user.id, tenant: tenant as Tenant, role: membership.role as MembershipRole };
});

/** Resolves the signed-in user's tenant/farmer/farm/active-flock. Returns
 * null at whichever stage is missing so callers can redirect appropriately
 * (e.g. back to /onboarding). Cached per-request since several server
 * components on the same page need this. */
export const getMyFarmerContext = cache(async (): Promise<FarmerContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("poultryedos_tenant_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const { data: tenant } = await supabase
    .from("poultryedos_tenants")
    .select("*")
    .eq("id", membership.tenant_id)
    .maybeSingle();
  if (!tenant) return null;

  const { data: farmer } = await supabase
    .from("poultryedos_farmers")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!farmer) return null;

  const { data: farm } = await supabase
    .from("poultryedos_farms")
    .select("*")
    .eq("farmer_id", farmer.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!farm) return null;

  const { data: flock } = await supabase
    .from("poultryedos_flocks")
    .select("*")
    .eq("farm_id", farm.id)
    .eq("status", "active")
    .order("placement_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    tenant: tenant as Tenant,
    farmer: farmer as Farmer,
    farm: farm as Farm,
    flock: (flock as Flock) ?? null,
  };
});

export async function getFlockById(flockId: string): Promise<Flock | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("poultryedos_flocks").select("*").eq("id", flockId).maybeSingle();
  return (data as Flock) ?? null;
}

export async function getAllFlocks(farmId: string): Promise<Flock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_flocks")
    .select("*")
    .eq("farm_id", farmId)
    .order("placement_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Flock[];
}

/**
 * Picks which flock a flock-scoped page (Record Today, Health, Vaccination,
 * Medications, Finance) should act on. Previously every one of those pages
 * silently defaulted to "most recently placed active flock" with no way to
 * pick a different one — a real problem the moment a farm has more than one
 * batch going at once. Now: honor an explicit `?flock=` query param if it
 * names a flock that actually belongs to this farm, otherwise fall back to
 * the old default so single-flock farms see no change at all.
 */
export async function resolveSelectedFlock(
  farmId: string,
  requestedFlockId?: string,
): Promise<{ flock: Flock | null; allFlocks: Flock[] }> {
  const allFlocks = await getAllFlocks(farmId);

  if (requestedFlockId) {
    const requested = allFlocks.find((f) => f.id === requestedFlockId);
    if (requested) return { flock: requested, allFlocks };
  }

  const defaultFlock =
    allFlocks
      .filter((f) => f.status === "active")
      .sort((a, b) => (a.placement_date < b.placement_date ? 1 : -1))[0] ?? null;

  return { flock: defaultFlock, allFlocks };
}

export async function getRecentDailyRecords(flockId: string, limit = 14): Promise<DailyRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_daily_records")
    .select("*")
    .eq("flock_id", flockId)
    .order("record_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DailyRecord[];
}

export async function getTodayRecord(flockId: string): Promise<DailyRecord | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("poultryedos_daily_records")
    .select("*")
    .eq("flock_id", flockId)
    .eq("record_date", today)
    .maybeSingle();

  return (data as DailyRecord) ?? null;
}

export async function getUpcomingVaccinations(flockId: string): Promise<VaccinationSchedule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_vaccination_schedules")
    .select("*")
    .eq("flock_id", flockId)
    .is("administered_date", null)
    .order("scheduled_date")
    .limit(5);

  if (error) throw error;
  return (data ?? []) as VaccinationSchedule[];
}

export interface MortalityAlert {
  level: "normal" | "watch" | "warning" | "critical";
  message: string;
}

/** Level-1, rule-based mortality check (spec section 23/51) — explicitly
 * NOT a diagnosis, just a comparison against the flock's own recent
 * baseline, with wording that recommends a look rather than asserting a
 * cause. */
export function computeMortalityAlert(records: DailyRecord[]): MortalityAlert | null {
  if (records.length === 0) return null;
  const [today, ...rest] = records;
  if (rest.length < 3) return null; // not enough history yet to have a "normal"

  const baseline = rest.slice(0, 7);
  const avg = baseline.reduce((sum, r) => sum + r.mortality, 0) / baseline.length;

  if (today.mortality === 0) return null;
  if (avg === 0 && today.mortality >= 3) {
    return {
      level: "warning",
      message: `${today.mortality} birds died today after little to no mortality recently. Worth a closer look.`,
    };
  }
  if (avg > 0 && today.mortality >= avg * 3 && today.mortality >= 3) {
    return {
      level: "critical",
      message: `Mortality today (${today.mortality}) is well above this flock's recent average (${avg.toFixed(1)}/day). Veterinary review is recommended.`,
    };
  }
  if (avg > 0 && today.mortality >= avg * 2) {
    return {
      level: "warning",
      message: `Mortality today (${today.mortality}) is above this flock's recent average (${avg.toFixed(1)}/day).`,
    };
  }
  return null;
}
