"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BiosecurityCheck } from "@/lib/database.types";
import { biosecurityScore } from "@/lib/biosecurity-score";

const FIELDS: { key: keyof BiosecurityCheck; label: string }[] = [
  { key: "footbath", label: "Footbath in use and topped up" },
  { key: "visitor_control", label: "Visitors controlled / hands washed" },
  { key: "ppe_used", label: "Protective clothing used" },
  { key: "cleaning_done", label: "House cleaned" },
  { key: "disinfection_done", label: "Disinfection done" },
  { key: "rodent_control", label: "Rodent control checked" },
  { key: "dead_bird_disposal", label: "Dead birds disposed of promptly" },
  { key: "feed_hygiene", label: "Feed stored away from pests" },
  { key: "water_sanitation", label: "Water source clean" },
];

export function BiosecurityManager({
  tenantId,
  farmId,
  checks,
  todayCheck,
}: {
  tenantId: string;
  farmId: string;
  checks: BiosecurityCheck[];
  todayCheck: BiosecurityCheck | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const f of FIELDS) initial[f.key] = todayCheck ? Boolean(todayCheck[f.key]) : false;
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_biosecurity_checks").upsert(
      { tenant_id: tenantId, farm_id: farmId, check_date: new Date().toISOString().slice(0, 10), ...values },
      { onConflict: "farm_id,check_date" },
    );
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const liveScore = Math.round(
    (Object.values(values).filter(Boolean).length / FIELDS.length) * 100,
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Biosecurity</h1>

      <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-5 text-center">
        <p className="text-xs text-ink-faint">Today&apos;s score</p>
        <p className="mt-1 font-display text-4xl font-medium text-ink">{liveScore}%</p>
      </div>

      <div className="mt-4 space-y-2">
        {FIELDS.map((f) => (
          <label
            key={f.key}
            className="flex items-center gap-3 rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm"
          >
            <input
              type="checkbox"
              checked={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))}
              className="h-4 w-4"
            />
            {f.label}
          </label>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {saved && !error && <p className="mt-3 text-sm text-success">Saved for today.</p>}

      <button
        type="button"
        disabled={busy}
        onClick={handleSave}
        className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save today's checklist"}
      </button>

      {checks.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-medium text-ink-soft">Recent scores</h2>
          <div className="mt-2 space-y-1.5">
            {checks.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm">
                <span className="text-ink-soft">
                  {new Date(c.check_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </span>
                <span className="font-medium text-ink">{biosecurityScore(c)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
