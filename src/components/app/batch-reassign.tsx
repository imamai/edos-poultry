"use client";

import { useState } from "react";
import type { Flock } from "@/lib/database.types";

/** Small inline "which batch was this actually for" corrector, shared by
 * ExpenseManager and SalesManager — both silently defaulted every entry
 * to whichever flock getMyFarmerContext() considered "current" (the most
 * recently placed active one) before a batch selector existed at all, so
 * a farm running more than one concurrent batch could easily have real
 * expenses/sales sitting on the wrong one with no way to correct it. */
export function BatchReassign({
  currentFlockId,
  flocks,
  onSave,
  onCancel,
}: {
  currentFlockId: string | null;
  flocks: Flock[];
  onSave: (flockId: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(currentFlockId ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 rounded-lg border border-line-strong px-2 py-1.5 text-xs outline-none focus:border-primary"
      >
        <option value="">General (not batch-specific)</option>
        {flocks.map((f) => (
          <option key={f.id} value={f.id}>
            {f.batch_code} {f.status !== "active" ? `(${f.status.replace("_", " ")})` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onSave(value || null);
          setBusy(false);
        }}
        className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
