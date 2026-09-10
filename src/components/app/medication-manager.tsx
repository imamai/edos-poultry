"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MedicationRecord, MedicationType } from "@/lib/database.types";

const TYPES: { value: MedicationType; label: string }[] = [
  { value: "antibiotic", label: "Antibiotic" },
  { value: "multivitamin", label: "Multivitamin" },
  { value: "dewormer", label: "Dewormer" },
  { value: "other", label: "Other" },
];

export function MedicationManager({
  tenantId,
  flockId,
  records,
}: {
  tenantId: string;
  flockId: string;
  records: MedicationRecord[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [medicationType, setMedicationType] = useState<MedicationType>("dewormer");
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [givenDate, setGivenDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_medication_records").insert({
      tenant_id: tenantId,
      flock_id: flockId,
      medication_type: medicationType,
      medication_name: medicationName,
      dosage: dosage || null,
      given_date: givenDate,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMedicationName("");
    setDosage("");
    setAdding(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Medications</h1>
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

      {adding && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">Type</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setMedicationType(t.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    medicationType === t.value
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line-strong text-ink-soft"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <input
            required
            value={medicationName}
            onChange={(e) => setMedicationName(e.target.value)}
            placeholder="Medication name"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="Dosage (optional)"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="date"
            value={givenDate}
            onChange={(e) => setGivenDate(e.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {records.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No medications logged.
          </p>
        )}
        {records.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">{r.medication_name}</p>
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs capitalize text-primary">{r.medication_type}</span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {new Date(r.given_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              {r.dosage && ` · ${r.dosage}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
