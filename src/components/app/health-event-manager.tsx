"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HealthEvent } from "@/lib/database.types";

export function HealthEventManager({
  tenantId,
  flockId,
  events,
}: {
  tenantId: string;
  flockId: string;
  events: HealthEvent[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [treatment, setTreatment] = useState("");
  const [veterinarian, setVeterinarian] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_health_events").insert({
      tenant_id: tenantId,
      flock_id: flockId,
      symptoms,
      treatment: treatment || null,
      veterinarian: veterinarian || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSymptoms("");
    setTreatment("");
    setVeterinarian("");
    setAdding(false);
    router.refresh();
  }

  async function markResolved(id: string) {
    const supabase = createClient();
    await supabase.from("poultryedos_health_events").update({ resolved: true }).eq("id", id);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Health</h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + Log
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Nothing here diagnoses or prescribes — it&apos;s a record to bring to a vet, and to spot patterns over time.
      </p>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-line bg-paper-raised p-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">What are you seeing?</label>
            <textarea
              required
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              rows={3}
              placeholder="e.g. a few birds lethargic, reduced feed intake"
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">What did you do? (optional)</label>
            <textarea
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">Vet contacted? (optional)</label>
            <input
              value={veterinarian}
              onChange={(e) => setVeterinarian(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
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

      <div className="mt-4 space-y-2">
        {events.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No health events logged.
          </p>
        )}
        {events.map((e) => (
          <div key={e.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-ink-faint">
                {new Date(e.event_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </p>
              {e.resolved ? (
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">Resolved</span>
              ) : (
                <button
                  type="button"
                  onClick={() => markResolved(e.id)}
                  className="text-xs text-primary hover:underline"
                >
                  Mark resolved
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-ink">{e.symptoms}</p>
            {e.treatment && <p className="mt-1 text-sm text-ink-soft">Action: {e.treatment}</p>}
            {e.veterinarian && <p className="mt-1 text-xs text-ink-faint">Vet: {e.veterinarian}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
