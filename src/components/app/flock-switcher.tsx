"use client";

import { useRouter, usePathname } from "next/navigation";
import type { Flock } from "@/lib/database.types";

/**
 * Only renders anything when there's a real choice to make (2+ flocks on
 * the farm) — a single-flock farm sees no extra UI at all, matching the
 * "don't force enterprise complexity on new farmers" principle even though
 * the underlying page now always supports switching.
 */
export function FlockSwitcher({ flocks, selectedId }: { flocks: Flock[]; selectedId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();

  if (flocks.length < 2) return null;

  return (
    <div className="mb-4">
      <label className="text-xs font-medium text-ink-faint">Batch</label>
      <select
        value={selectedId ?? ""}
        onChange={(e) => router.push(`${pathname}?flock=${e.target.value}`)}
        className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
      >
        {flocks.map((f) => (
          <option key={f.id} value={f.id}>
            {f.batch_code} {f.status !== "active" ? `(${f.status.replace("_", " ")})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
