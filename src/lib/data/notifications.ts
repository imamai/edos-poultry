import { createClient } from "@/lib/supabase/server";
import type { FarmerContext, MembershipContext } from "@/lib/data/farmer";
import { getAllFlocks, getRecentDailyRecords, computeMortalityAlert } from "@/lib/data/farmer";
import { getTenantSubscription, deriveSubscriptionStatus } from "@/lib/data/subscriptions";
import { predictFeedStockout, predictProductionTrend } from "@/lib/ai/predictions";
import type { Notification } from "@/lib/database.types";

export async function getNotifications(userId: string, limit = 30): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("poultryedos_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("poultryedos_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("poultryedos_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

interface DraftNotification {
  type: Notification["type"];
  title: string;
  body: string;
  link?: string;
  dedupeKey: string;
}

/**
 * Generates whatever notifications are currently due for the signed-in
 * user and upserts them, keyed by dedupe_key so re-running this on every
 * page load never creates duplicates. There is no cron/background worker
 * in this app (see README) — this is the substitute: notifications are
 * derived lazily, the same read-time-computation approach used everywhere
 * else (biosecurityScore, deriveSubscriptionStatus). Best-effort: failures
 * here must never break page rendering.
 */
export async function ensureDueNotifications(
  membership: MembershipContext,
  farmerContext: FarmerContext | null,
): Promise<void> {
  try {
    const drafts: DraftNotification[] = [];
    const today = new Date().toISOString().slice(0, 10);

    if (farmerContext?.farm) {
      // farmerContext.flock is only ever the single "most recently placed
      // active" flock — checking just that one silently skipped vaccination/
      // mortality/production alerts for every other concurrent batch on a
      // multi-flock farm. Check all of the farm's active flocks instead.
      const allFlocks = await getAllFlocks(farmerContext.farm.id);
      const activeFlocks = allFlocks.filter((f) => f.status === "active");

      const supabase = await createClient();
      for (const flock of activeFlocks) {
        const { data: dueVaccinations } = await supabase
          .from("poultryedos_vaccination_schedules")
          .select("id, vaccine_name, scheduled_date")
          .eq("flock_id", flock.id)
          .is("administered_date", null)
          .lte("scheduled_date", addDays(today, 2))
          .order("scheduled_date");

        for (const v of dueVaccinations ?? []) {
          drafts.push({
            type: "vaccination_due",
            title: `${v.vaccine_name} due soon`,
            body: `${flock.batch_code} is due for ${v.vaccine_name} on ${v.scheduled_date}.`,
            link: `/app/vaccination?flock=${flock.id}`,
            dedupeKey: `vaccination_due:${v.id}`,
          });
        }

        const records = await getRecentDailyRecords(flock.id, 21);
        const mortalityAlert = records[0]?.record_date === today ? computeMortalityAlert(records) : null;
        if (mortalityAlert) {
          drafts.push({
            type: "mortality_alert",
            title: `Mortality alert — ${flock.batch_code}`,
            body: mortalityAlert.message,
            link: `/app/home?flock=${flock.id}`,
            dedupeKey: `mortality_alert:${flock.id}:${today}`,
          });
        }

        const trend = predictProductionTrend(records);
        if (trend.status === "ok" && trend.value.direction === "down") {
          drafts.push({
            type: "production_decline",
            title: `Egg production declining — ${flock.batch_code}`,
            body: trend.explanation,
            link: `/app/flock/${flock.id}`,
            // Re-derive weekly rather than daily — a trend doesn't meaningfully
            // change day to day, and re-notifying every single day would be
            // noise rather than a fresh signal.
            dedupeKey: `production_decline:${flock.id}:${weekOf(today)}`,
          });
        }
      }
    }

    if (membership.role === "owner" || membership.role === "admin" || farmerContext) {
      const supabase = await createClient();
      const { data: lowStockItems } = await supabase
        .from("poultryedos_inventory_items")
        .select("id, name, stock_on_hand, reorder_level, unit")
        .eq("tenant_id", membership.tenant.id)
        .eq("is_active", true)
        .not("reorder_level", "is", null);

      const alreadyLowStockIds = new Set<string>();
      for (const item of lowStockItems ?? []) {
        if (item.reorder_level != null && item.stock_on_hand <= item.reorder_level) {
          alreadyLowStockIds.add(item.id);
          drafts.push({
            type: "low_stock",
            title: `${item.name} running low`,
            body: `${item.stock_on_hand} ${item.unit} left, at or below the reorder level of ${item.reorder_level} ${item.unit}.`,
            link: "/app/inventory",
            dedupeKey: `low_stock:${item.id}:${today}`,
          });
        }
      }

      // Trend-based early warning, on top of the static reorder-level check
      // above: an item can be projected to run out soon even while still
      // above its reorder level, if usage has picked up. Skip items already
      // covered by low_stock so the two alerts don't overlap.
      const { data: allActiveItems } = await supabase
        .from("poultryedos_inventory_items")
        .select("id, name, unit, stock_on_hand")
        .eq("tenant_id", membership.tenant.id)
        .eq("is_active", true);

      for (const item of allActiveItems ?? []) {
        if (alreadyLowStockIds.has(item.id)) continue;
        const { data: recentOut } = await supabase
          .from("poultryedos_inventory_transactions")
          .select("quantity, transaction_date")
          .eq("item_id", item.id)
          .eq("transaction_type", "out")
          .gte("transaction_date", addDays(today, -14));

        const prediction = predictFeedStockout(item, recentOut ?? []);
        if (prediction.status === "ok" && prediction.value.daysRemaining <= 7) {
          drafts.push({
            type: "feed_stockout",
            title: `${item.name} may run out soon`,
            body: prediction.explanation,
            link: "/app/inventory",
            dedupeKey: `feed_stockout:${item.id}:${today}`,
          });
        }
      }
    }

    if (membership.role === "owner" || membership.role === "admin") {
      const subscription = await getTenantSubscription(membership.tenant.id);
      if (subscription) {
        const derived = deriveSubscriptionStatus(subscription);
        if (derived.status === "trial" && derived.daysRemaining != null && derived.daysRemaining <= 3) {
          drafts.push({
            type: "subscription",
            title: "Your trial is ending soon",
            body: `Your free trial ends in ${Math.max(derived.daysRemaining, 0)} day(s). Add a plan to keep access.`,
            link: "/app/billing",
            dedupeKey: `subscription:trial_ending:${derived.daysRemaining}`,
          });
        } else if (["past_due", "grace_period", "suspended"].includes(derived.status)) {
          drafts.push({
            type: "subscription",
            title: "Subscription payment needed",
            body:
              derived.status === "suspended"
                ? "Your subscription is suspended. Your data is safe — renew to restore full access."
                : "Your last payment didn't go through. Renew to avoid interruption.",
            link: "/app/billing",
            dedupeKey: `subscription:${derived.status}`,
          });
        }
      }
    }

    if (drafts.length === 0) return;

    const supabase = await createClient();
    await supabase.from("poultryedos_notifications").upsert(
      drafts.map((d) => ({
        tenant_id: membership.tenant.id,
        user_id: membership.userId,
        type: d.type,
        title: d.title,
        body: d.body,
        link: d.link ?? null,
        dedupe_key: d.dedupeKey,
      })),
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    );
  } catch {
    // Best-effort — notification generation must never break page render.
  }
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO-ish week key (year + week number) used only to dedupe a trend alert
 * at "once a week" granularity rather than every page load. */
function weekOf(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const firstDayOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - firstDayOfYear.getTime()) / 86400000 + firstDayOfYear.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNumber}`;
}
