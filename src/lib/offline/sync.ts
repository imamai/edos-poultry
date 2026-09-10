"use client";

import { createClient } from "@/lib/supabase/client";
import { getAllQueuedRecords, deleteQueuedRecord, saveQueuedRecord, type QueuedDailyRecord } from "./db";

export type SyncStatus = "online" | "offline" | "syncing" | "synced" | "sync-failed";

/**
 * Pushes every queued daily record to Supabase. Uses upsert on the
 * (flock_id, record_date) unique constraint so a record already saved
 * (e.g. a retried sync, or the farmer had already entered today's record
 * before going offline) is safely merged rather than duplicated or errored.
 */
export async function syncQueuedRecords(): Promise<{ synced: number; failed: number }> {
  const queued = await getAllQueuedRecords();
  const pending = queued.filter((r) => r.status === "pending" || r.status === "failed");
  if (pending.length === 0) return { synced: 0, failed: 0 };

  const supabase = createClient();
  let synced = 0;
  let failed = 0;

  for (const record of pending) {
    await saveQueuedRecord({ ...record, status: "syncing" });
    const { error } = await supabase
      .from("poultryedos_daily_records")
      .upsert(
        {
          tenant_id: record.tenantId,
          flock_id: record.flockId,
          record_date: record.recordDate,
          ...record.payload,
        },
        { onConflict: "flock_id,record_date" },
      );

    if (error) {
      failed += 1;
      await saveQueuedRecord({ ...record, status: "failed", error: error.message });
    } else {
      synced += 1;
      await deleteQueuedRecord(record.localId);
    }
  }

  return { synced, failed };
}

export async function queueDailyRecord(record: Omit<QueuedDailyRecord, "status" | "createdAt">) {
  await saveQueuedRecord({
    ...record,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}
