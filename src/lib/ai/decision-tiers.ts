import type { Notification, NotificationType } from "@/lib/database.types";

// EDOS Poultry360 Decision Center (spec §53) — "What needs my attention?"
// This is deliberately a *view* over the existing poultryedos_notifications
// table (see src/lib/data/notifications.ts), not a separate subsystem: the
// same alerts already shown via the header bell are grouped here into the
// spec's four priority tiers.

export type DecisionTier = "high" | "attention" | "monitor" | "opportunity";

export const TIER_LABELS: Record<DecisionTier, string> = {
  high: "High priority",
  attention: "Attention",
  monitor: "Monitor",
  opportunity: "Opportunity",
};

export const TIER_ORDER: DecisionTier[] = ["high", "attention", "monitor", "opportunity"];

const TIER_BY_TYPE: Record<NotificationType, DecisionTier> = {
  mortality_alert: "high",
  subscription: "high",
  feed_stockout: "attention",
  low_stock: "attention",
  vaccination_due: "attention",
  production_decline: "monitor",
  task_assigned: "monitor",
  support_ticket: "monitor",
  // No automatic "opportunity" signal is generated today (no external
  // market-demand data source exists) — reserved for a real one later
  // rather than fabricating a positive-sounding alert to fill the tier.
  general: "monitor",
};

export function tierOf(type: NotificationType): DecisionTier {
  return TIER_BY_TYPE[type] ?? "monitor";
}

/** Spec §53's "why does it matter? / what should I check? / what action is
 * recommended?" framing — one static hint set per notification *type*
 * (the notification's own title/body already carries the specific,
 * data-grounded "what happened," generated at the point each one is
 * created; see ensureDueNotifications). */
export const DECISION_HINTS: Record<NotificationType, { why: string; check: string; action: string }> = {
  mortality_alert: {
    why: "A sudden rise in deaths is often the earliest sign of a health or environment problem.",
    check: "Feed, water, temperature, and whether the birds look unwell.",
    action: "Isolate affected birds where practical and consider a veterinary review.",
  },
  feed_stockout: {
    why: "Running out of feed mid-cycle disrupts growth and egg production.",
    check: "Current stock and your usual reorder lead time.",
    action: "Place a purchase order now so it arrives before stock runs out.",
  },
  low_stock: {
    why: "Being below your reorder level risks running out before a new order arrives.",
    check: "How much you have left against typical daily usage.",
    action: "Reorder soon.",
  },
  vaccination_due: {
    why: "Missed or late vaccinations leave a flock exposed to preventable disease.",
    check: "Your vaccination schedule for this flock.",
    action: "Administer the vaccine on or near the due date.",
  },
  production_decline: {
    why: "A sustained drop in eggs usually has a findable cause — it rarely reverses on its own.",
    check: "Feed quality, water availability, heat stress, and house crowding.",
    action: "Investigate the likely cause this week rather than waiting to see if it continues.",
  },
  subscription: {
    why: "Your plan controls continued access to recording and reports.",
    check: "Your current plan and payment status on the Billing page.",
    action: "Renew or update your payment method.",
  },
  task_assigned: {
    why: "Assigned tasks left undone can delay farmer support.",
    check: "The task's due date and details.",
    action: "Complete it or follow up with whoever assigned it.",
  },
  support_ticket: {
    why: "A farmer is waiting on a response.",
    check: "The problem they described.",
    action: "Follow up with the farmer.",
  },
  general: {
    why: "Worth a look.",
    check: "The details in the notification.",
    action: "Review and decide if action is needed.",
  },
};

export function groupByTier(notifications: Notification[]): Record<DecisionTier, Notification[]> {
  const groups: Record<DecisionTier, Notification[]> = { high: [], attention: [], monitor: [], opportunity: [] };
  for (const n of notifications) {
    groups[tierOf(n.type)].push(n);
  }
  return groups;
}
