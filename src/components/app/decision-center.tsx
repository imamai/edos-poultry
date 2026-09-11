"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertOctagon, TriangleAlert, Eye, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/database.types";
import { TIER_ORDER, TIER_LABELS, DECISION_HINTS, groupByTier, type DecisionTier } from "@/lib/ai/decision-tiers";

const TIER_STYLES: Record<DecisionTier, { icon: typeof AlertOctagon; badge: string; border: string }> = {
  high: { icon: AlertOctagon, badge: "bg-danger-soft text-danger", border: "border-danger/40" },
  attention: { icon: TriangleAlert, badge: "bg-warning-soft text-warning", border: "border-warning/40" },
  monitor: { icon: Eye, badge: "bg-accent-soft text-accent-dark", border: "border-line" },
  opportunity: { icon: Sparkles, badge: "bg-success-soft text-success", border: "border-success/40" },
};

export function DecisionCenter({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState<string | null>(null);

  const unread = notifications.filter((n) => !n.read_at);
  const groups = groupByTier(unread);

  async function dismiss(id: string) {
    setDismissing(id);
    const supabase = createClient();
    await supabase.from("poultryedos_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setDismissing(null);
    router.refresh();
  }

  const totalCount = unread.length;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">What needs my attention?</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {totalCount === 0
          ? "Nothing needs your attention right now."
          : `${totalCount} thing${totalCount === 1 ? "" : "s"} to look at, grouped by priority.`}
      </p>

      <div className="mt-5 space-y-6">
        {TIER_ORDER.map((tier) => {
          const items = groups[tier];
          if (items.length === 0) return null;
          const { icon: Icon, badge, border } = TIER_STYLES[tier];

          return (
            <div key={tier}>
              <p className="flex items-center gap-2 text-sm font-medium text-ink-soft">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
                  <Icon className="h-3.5 w-3.5" /> {TIER_LABELS[tier]}
                </span>
              </p>
              <div className="mt-2 space-y-2">
                {items.map((n) => {
                  const hint = DECISION_HINTS[n.type];
                  return (
                    <div key={n.id} className={`rounded-xl border ${border} bg-paper-raised p-4`}>
                      <p className="font-medium text-ink">{n.title}</p>
                      <p className="mt-1 text-sm text-ink-soft">{n.body}</p>
                      {hint && (
                        <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs text-ink-faint">
                          <div>
                            <dt className="inline font-medium text-ink-soft">Why it matters: </dt>
                            <dd className="inline">{hint.why}</dd>
                          </div>
                          <div>
                            <dt className="inline font-medium text-ink-soft">Check: </dt>
                            <dd className="inline">{hint.check}</dd>
                          </div>
                          <div>
                            <dt className="inline font-medium text-ink-soft">Recommended action: </dt>
                            <dd className="inline">{hint.action}</dd>
                          </div>
                        </dl>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        {n.link && (
                          <Link href={n.link} className="text-xs font-medium text-primary hover:underline">
                            Go there →
                          </Link>
                        )}
                        <button
                          type="button"
                          disabled={dismissing === n.id}
                          onClick={() => dismiss(n.id)}
                          className="text-xs text-ink-faint hover:text-ink-soft disabled:opacity-60"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {totalCount === 0 && (
          <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-ink-faint">
            You&apos;re all caught up.
          </p>
        )}
      </div>
    </div>
  );
}
