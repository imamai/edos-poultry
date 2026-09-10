"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { VaccinationSchedule } from "@/lib/database.types";

function addDays(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function VaccinationManager({
  tenantId,
  flockId,
  placementDate,
  schedules,
}: {
  tenantId: string;
  flockId: string;
  placementDate: string;
  schedules: VaccinationSchedule[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [vaccineName, setVaccineName] = useState("");
  const [mode, setMode] = useState<"age" | "date">("age");
  const [ageDays, setAgeDays] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedDateFromAge = ageDays ? addDays(placementDate, Number(ageDays)) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const finalDate = mode === "age" ? computedDateFromAge : scheduledDate;
    const { error } = await supabase.from("poultryedos_vaccination_schedules").insert({
      tenant_id: tenantId,
      flock_id: flockId,
      vaccine_name: vaccineName,
      scheduled_date: finalDate,
      age_days: mode === "age" ? Number(ageDays) : null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setVaccineName("");
    setAgeDays("");
    setAdding(false);
    router.refresh();
  }

  async function markAdministered(id: string) {
    const supabase = createClient();
    await supabase
      .from("poultryedos_vaccination_schedules")
      .update({ administered_date: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    router.refresh();
  }

  const upcoming = schedules.filter((s) => !s.administered_date);
  const done = schedules.filter((s) => s.administered_date);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Vaccination</h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + Schedule
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-line bg-paper-raised p-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">Vaccine</label>
            <input
              required
              value={vaccineName}
              onChange={(e) => setVaccineName(e.target.value)}
              placeholder="e.g. Newcastle disease vaccine"
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">When is it due?</label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("age")}
                className={`flex-1 rounded-full border px-3 py-2 text-sm ${
                  mode === "age" ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
                }`}
              >
                By age
              </button>
              <button
                type="button"
                onClick={() => setMode("date")}
                className={`flex-1 rounded-full border px-3 py-2 text-sm ${
                  mode === "date" ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
                }`}
              >
                By date
              </button>
            </div>
          </div>

          {mode === "age" ? (
            <div>
              <label className="text-sm font-medium text-ink-soft">Days after placement</label>
              <input
                type="number"
                required
                min={0}
                value={ageDays}
                onChange={(e) => setAgeDays(e.target.value)}
                placeholder="e.g. 14"
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {computedDateFromAge && (
                <p className="mt-1 text-xs text-ink-faint">
                  = {new Date(computedDateFromAge).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-ink-soft">Scheduled date</label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full border border-line-strong px-5 py-2.5 text-sm font-medium text-ink-soft"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <h2 className="mt-6 text-sm font-medium text-ink-soft">Upcoming</h2>
      <div className="mt-2 space-y-2">
        {upcoming.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-ink-faint">
            Nothing scheduled.
          </p>
        )}
        {upcoming.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-line bg-paper-raised px-4 py-3">
            <div>
              <p className="font-medium text-ink">{s.vaccine_name}</p>
              <p className="text-xs text-ink-faint">
                Due {new Date(s.scheduled_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                {s.age_days != null && ` · day ${s.age_days}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => markAdministered(s.id)}
              className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
            >
              Mark given
            </button>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-medium text-ink-soft">History</h2>
          <div className="mt-2 space-y-2">
            {done.map((s) => (
              <div key={s.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
                <p className="font-medium text-ink">{s.vaccine_name}</p>
                <p className="text-xs text-ink-faint">
                  Given {new Date(s.administered_date!).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
