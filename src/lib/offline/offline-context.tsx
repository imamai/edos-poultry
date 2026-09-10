"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { queueDailyRecord, syncQueuedRecords, type SyncStatus } from "./sync";
import { getAllQueuedRecords, type QueuedDailyRecord } from "./db";

interface OfflineContextValue {
  status: SyncStatus;
  pendingCount: number;
  submitDailyRecord: (record: Omit<QueuedDailyRecord, "status" | "createdAt">) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online",
  );
  const [pendingCount, setPendingCount] = useState(0);
  const syncing = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const all = await getAllQueuedRecords();
      setPendingCount(all.filter((r) => r.status !== "synced").length);
    } catch {
      // IndexedDB unavailable (e.g. private browsing) — degrade silently,
      // offline queuing just won't work in that session.
    }
  }, []);

  const runSync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    setStatus("syncing");
    try {
      const { failed } = await syncQueuedRecords();
      setStatus(failed > 0 ? "sync-failed" : "synced");
    } catch {
      setStatus("sync-failed");
    } finally {
      syncing.current = false;
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    getAllQueuedRecords()
      .then((all) => setPendingCount(all.filter((r) => r.status !== "synced").length))
      .catch(() => {});

    const handleOnline = () => {
      setStatus("online");
      runSync();
    };
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Initial sync attempt on mount, in case records were queued in a
    // previous offline session — legitimately synchronizes with the
    // IndexedDB queue and network, same shape as the event listeners above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSync();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runSync]);

  const submitDailyRecord = useCallback(
    async (record: Omit<QueuedDailyRecord, "status" | "createdAt">) => {
      await queueDailyRecord(record);
      await refreshPendingCount();
      if (navigator.onLine) {
        await runSync();
      }
    },
    [runSync, refreshPendingCount],
  );

  return (
    <OfflineContext.Provider value={{ status, pendingCount, submitDailyRecord }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within an OfflineProvider");
  return ctx;
}
