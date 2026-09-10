"use client";

// Minimal IndexedDB wrapper for the offline daily-record queue. No external
// dependency (Dexie etc.) — the schema here is small enough that the native
// API stays readable, and it avoids pulling in a library for one object
// store.

const DB_NAME = "edos-poultry-offline";
const DB_VERSION = 1;
const STORE = "pending_daily_records";

export interface QueuedDailyRecord {
  localId: string;
  tenantId: string;
  flockId: string;
  recordDate: string; // YYYY-MM-DD
  payload: {
    mortality: number;
    culls: number;
    birds_sold: number;
    eggs_collected: number | null;
    feed_consumed_kg: number | null;
    sales_amount_cents: number;
    notes: string | null;
  };
  status: "pending" | "syncing" | "synced" | "failed";
  error?: string;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveQueuedRecord(record: QueuedDailyRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllQueuedRecords(): Promise<QueuedDailyRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as QueuedDailyRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteQueuedRecord(localId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
