import { createClient } from "@/lib/supabase/server";
import type {
  EffectiveSubscriptionStatus,
  PlanLimits,
  Subscription,
  SubscriptionPlan,
} from "@/lib/database.types";

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as SubscriptionPlan[];
}

export async function getTenantSubscription(
  tenantId: string,
): Promise<(Subscription & { poultryedos_subscription_plans: SubscriptionPlan }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("poultryedos_subscriptions")
    .select("*, poultryedos_subscription_plans(*)")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as (Subscription & { poultryedos_subscription_plans: SubscriptionPlan }) | null) ?? null;
}

// A payment made after the period ends is still due "soon" for a few days
// before the tenant is asked to renew under pressure (past_due), and access
// isn't cut immediately even then — there's a further grace window before
// suspension. Both windows are deliberately short and named so the
// lifecycle in PRODUCT_SPEC.md §46 (Active -> Renewal reminder -> Payment
// due -> Grace period -> Suspension) is legible directly from the code, not
// just from a magic number.
const PAST_DUE_DAYS = 3;
const GRACE_PERIOD_DAYS = 7;

export interface DerivedSubscriptionStatus {
  status: EffectiveSubscriptionStatus;
  /** Days until trial_ends_at / current_period_end, when that's the
   * relevant upcoming date for the current status. Negative once passed. */
  daysRemaining: number | null;
}

/** Computes the subscription state actually shown to users from stored
 * dates, the same "derive at read time, don't pre-compute" approach as
 * biosecurityScore() — there is no background job in this app that could
 * flip a stored status column on a schedule. */
export function deriveSubscriptionStatus(
  sub: Pick<Subscription, "status" | "trial_ends_at" | "current_period_end">,
  now: Date = new Date(),
): DerivedSubscriptionStatus {
  if (sub.status === "cancelled") {
    return { status: "cancelled", daysRemaining: null };
  }

  if (sub.status === "trial") {
    if (!sub.trial_ends_at) return { status: "trial", daysRemaining: null };
    const daysLeft = daysBetween(now, new Date(sub.trial_ends_at));
    return { status: daysLeft >= 0 ? "trial" : "expired", daysRemaining: daysLeft };
  }

  // status === "active"
  if (!sub.current_period_end) {
    return { status: "active", daysRemaining: null };
  }
  const daysSincePeriodEnd = daysBetween(new Date(sub.current_period_end), now);
  if (daysSincePeriodEnd <= 0) {
    return { status: "active", daysRemaining: -daysSincePeriodEnd };
  }
  if (daysSincePeriodEnd <= PAST_DUE_DAYS) {
    return { status: "past_due", daysRemaining: PAST_DUE_DAYS - daysSincePeriodEnd };
  }
  if (daysSincePeriodEnd <= PAST_DUE_DAYS + GRACE_PERIOD_DAYS) {
    return { status: "grace_period", daysRemaining: PAST_DUE_DAYS + GRACE_PERIOD_DAYS - daysSincePeriodEnd };
  }
  return { status: "suspended", daysRemaining: null };
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export interface PlanUsage {
  limits: PlanLimits;
  usage: Partial<Record<keyof PlanLimits, number>>;
}

/** Current resource counts against the plan's configured limits, for the
 * billing page's usage bars. A limit key that's absent from `limits` means
 * unlimited for that resource — nothing to compare against. */
export async function getPlanUsage(tenantId: string, limits: PlanLimits): Promise<PlanUsage> {
  const supabase = await createClient();
  const usage: Partial<Record<keyof PlanLimits, number>> = {};

  const counters: { key: keyof PlanLimits; table: string }[] = [];
  if (limits.farmers != null) counters.push({ key: "farmers", table: "poultryedos_farmers" });
  if (limits.farms != null) counters.push({ key: "farms", table: "poultryedos_farms" });
  if (limits.houses != null) counters.push({ key: "houses", table: "poultryedos_houses" });
  if (limits.flocks != null) counters.push({ key: "flocks", table: "poultryedos_flocks" });

  const counts = await Promise.all(
    counters.map((c) => supabase.from(c.table).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId)),
  );
  counters.forEach((c, i) => {
    usage[c.key] = counts[i].count ?? 0;
  });

  if (limits.users != null || limits.field_officers != null) {
    const { data: memberships } = await supabase
      .from("poultryedos_tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("status", "active");
    if (limits.users != null) usage.users = memberships?.length ?? 0;
    if (limits.field_officers != null) {
      usage.field_officers = (memberships ?? []).filter((m) => m.role === "field_officer").length;
    }
  }

  return { limits, usage };
}
