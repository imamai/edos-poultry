"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Syringe, Boxes, TriangleAlert, CreditCard, LifeBuoy, ListChecks, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification, NotificationType } from "@/lib/database.types";

const ICONS: Record<NotificationType, typeof Bell> = {
  vaccination_due: Syringe,
  low_stock: Boxes,
  mortality_alert: TriangleAlert,
  subscription: CreditCard,
  support_ticket: LifeBuoy,
  task_assigned: ListChecks,
  general: Bell,
};

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAllRead() {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("poultryedos_notifications")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        notifications.filter((n) => !n.read_at).map((n) => n.id),
      );
    setBusy(false);
    router.refresh();
  }

  async function markRead(id: string) {
    const supabase = createClient();
    await supabase.from("poultryedos_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    router.refresh();
  }

  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div>
      {hasUnread && (
        <div className="mt-2 flex justify-end">
          <button type="button" disabled={busy} onClick={markAllRead} className="text-xs text-primary hover:underline disabled:opacity-60">
            Mark all as read
          </button>
        </div>
      )}

      <div className="mt-2 space-y-2">
        {notifications.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            Nothing here yet.
          </p>
        )}
        {notifications.map((n) => {
          const Icon = ICONS[n.type] ?? Bell;
          const body = (
            <div
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                n.read_at ? "border-line bg-paper-raised" : "border-primary/40 bg-primary-soft"
              }`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-ink">{n.title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {new Date(n.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );

          return (
            <div key={n.id} onClick={() => !n.read_at && markRead(n.id)}>
              {n.link ? (
                <Link href={n.link} className="block">
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
