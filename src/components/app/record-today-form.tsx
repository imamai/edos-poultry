"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyRecord } from "@/lib/database.types";
import { useOffline } from "@/lib/offline/offline-context";
import { getDictionary } from "@/lib/i18n/translations";

function numberField(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function RecordTodayForm({
  tenantId,
  flockId,
  existing,
  locale,
}: {
  tenantId: string;
  flockId: string;
  existing: DailyRecord | null;
  locale?: string;
}) {
  const router = useRouter();
  const { submitDailyRecord } = useOffline();
  const t = getDictionary(locale).record;

  const [mortality, setMortality] = useState(String(existing?.mortality ?? 0));
  const [eggs, setEggs] = useState(existing?.eggs_collected != null ? String(existing.eggs_collected) : "");
  const [feedKg, setFeedKg] = useState(existing?.feed_consumed_kg != null ? String(existing.feed_consumed_kg) : "");
  const [salesAmount, setSalesAmount] = useState(
    existing ? String(existing.sales_amount_cents / 100) : "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const today = new Date().toISOString().slice(0, 10);
    await submitDailyRecord({
      localId: `${flockId}:${today}`,
      tenantId,
      flockId,
      recordDate: today,
      payload: {
        mortality: numberField(mortality),
        culls: 0,
        birds_sold: 0,
        eggs_collected: eggs === "" ? null : numberField(eggs),
        feed_consumed_kg: feedKg === "" ? null : Number(feedKg),
        sales_amount_cents: salesAmount === "" ? 0 : Math.round(Number(salesAmount) * 100),
        notes: notes || null,
      },
    });

    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  if (saved) {
    return (
      <div className="mt-8 rounded-2xl border border-success bg-success-soft p-6 text-center">
        <p className="font-medium text-success">{t.savedTitle}</p>
        <p className="mt-1 text-sm text-ink-soft">{t.savedBody}</p>
        <button
          type="button"
          onClick={() => router.push("/app/home")}
          className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-primary-dark"
        >
          {t.backHome}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <NumberInput label={t.deaths} value={mortality} onChange={setMortality} placeholder="0" />
      <NumberInput label={t.eggs} value={eggs} onChange={setEggs} placeholder="e.g. 198" />
      <NumberInput label={t.feed} value={feedKg} onChange={setFeedKg} placeholder="e.g. 34" step="0.1" />
      <NumberInput label={t.sales} value={salesAmount} onChange={setSalesAmount} placeholder="e.g. 4500" />
      <div>
        <label className="text-sm font-medium text-ink-soft">{t.notes}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-3.5 text-base font-medium text-white shadow-card hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? t.saving : t.save}
      </button>
    </form>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-ink-soft">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step ?? "1"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-line-strong bg-paper-raised px-4 py-3 text-lg outline-none focus:border-primary"
      />
    </div>
  );
}
