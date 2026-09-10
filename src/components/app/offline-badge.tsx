"use client";

import { useOffline } from "@/lib/offline/offline-context";

const LABELS: Record<string, { label: string; className: string }> = {
  online: { label: "Online", className: "bg-success-soft text-success" },
  offline: { label: "Offline", className: "bg-warning-soft text-warning" },
  syncing: { label: "Syncing…", className: "bg-accent-soft text-accent-dark" },
  synced: { label: "Synced", className: "bg-success-soft text-success" },
  "sync-failed": { label: "Sync failed", className: "bg-danger-soft text-danger" },
};

export function OfflineBadge() {
  const { status, pendingCount } = useOffline();
  const meta = LABELS[status] ?? LABELS.online;

  if (status === "online" && pendingCount === 0) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
      {pendingCount > 0 && status !== "syncing" && ` (${pendingCount} pending)`}
    </span>
  );
}
