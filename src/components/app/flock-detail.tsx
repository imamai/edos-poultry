"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DailyRecord, Flock } from "@/lib/database.types";
import type { FeedEfficiency } from "@/lib/feed-efficiency";
import type { FlockFinance } from "@/lib/data/business";
import type { PredictionResult, ProductionTrendPrediction } from "@/lib/ai/predictions";
import { formatMoney } from "@/lib/money";
import { PrintHeader, PrintSection, PrintRow } from "@/components/app/print-report";
import { downloadSimpleReportPdf } from "@/lib/pdf/simple-report";

export function FlockDetail({
  flock,
  poultryTypeName,
  farmName,
  tenantName,
  records,
  feedEfficiency,
  finance,
  currency,
  productionTrend,
}: {
  flock: Flock;
  poultryTypeName: string | null;
  farmName: string;
  tenantName: string;
  records: DailyRecord[];
  feedEfficiency: FeedEfficiency;
  finance: FlockFinance;
  currency: string;
  productionTrend: PredictionResult<ProductionTrendPrediction>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [breed, setBreed] = useState(flock.breed ?? "");
  const [supplier, setSupplier] = useState(flock.supplier ?? "");
  const [source, setSource] = useState(flock.source ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageDays = Math.floor(
    (new Date().getTime() - new Date(flock.placement_date).getTime()) / (1000 * 60 * 60 * 24),
  );
  const mortalityPct = (finance.totalMortality / flock.initial_quantity) * 100;
  const placedLabel = new Date(flock.placement_date).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  function handleDownloadPdf() {
    downloadSimpleReportPdf({
      tenantName,
      subtitle: farmName,
      title: `Flock Summary — ${flock.batch_code}`,
      filename: `${flock.batch_code}-summary.pdf`,
      sections: [
        {
          title: "Batch details",
          rows: [
            ["Poultry type", poultryTypeName ?? "—"],
            ["Breed", flock.breed ?? "—"],
            ["Company (hatchery)", flock.supplier ?? "—"],
            ["Source of birds", flock.source ?? "—"],
            ["Date received", placedLabel],
            ["Age", `${ageDays} days`],
          ],
        },
        {
          title: "Production summary",
          rows: [
            ["Started with", `${flock.initial_quantity} birds`],
            ["Alive now", `${flock.current_quantity} birds`],
            ["Mortality", `${mortalityPct.toFixed(1)}%`],
            ["Total eggs (recent period)", String(feedEfficiency.totalEggs)],
            ["Total feed used (recent period)", `${feedEfficiency.totalFeedKg.toFixed(1)} kg`],
            [
              "Feed per bird per day",
              feedEfficiency.gramsPerBirdPerDay != null ? `${feedEfficiency.gramsPerBirdPerDay.toFixed(0)} g` : "—",
            ],
            [
              "Feed conversion (kg feed / dozen eggs)",
              feedEfficiency.feedPerDozenEggsKg != null ? feedEfficiency.feedPerDozenEggsKg.toFixed(2) : "—",
            ],
          ],
        },
        {
          title: "Financial summary",
          rows: [
            ["Total revenue", formatMoney(finance.totalRevenueCents, currency)],
            ["Total expenses", formatMoney(finance.totalExpensesCents, currency)],
            [
              finance.profitCents >= 0 ? "Estimated profit" : "Estimated loss",
              formatMoney(Math.abs(finance.profitCents), currency),
            ],
          ],
        },
      ],
      table: {
        title: "Recent daily records",
        head: ["Date", "Eggs", "Deaths", "Feed (kg)", "Sales"],
        body: records.map((r) => [
          new Date(r.record_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
          r.eggs_collected ?? "—",
          r.mortality,
          r.feed_consumed_kg ?? "—",
          formatMoney(r.sales_amount_cents, currency),
        ]),
      },
    });
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("poultryedos_flocks")
      .update({ breed: breed || null, supplier: supplier || null, source: source || null })
      .eq("id", flock.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      {/* ---------- Interactive screen view ---------- */}
      <div className="print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink">{flock.batch_code}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
            >
              <Download className="h-4 w-4" /> PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Detail label="Type" value={poultryTypeName ?? "—"} />
          <Detail label="Age" value={`${ageDays} days`} />
          <Detail label="Placed" value={placedLabel} />
          <Detail label="Started with" value={String(flock.initial_quantity)} />
          <Detail label="Alive now" value={String(flock.current_quantity)} />
          <Detail label="Mortality" value={`${mortalityPct.toFixed(1)}%`} />
        </div>

        <div className="mt-4 rounded-xl border border-line bg-paper-raised p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-soft">Breed, company &amp; source</p>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
                Edit
              </button>
            )}
          </div>
          {editing ? (
            <form onSubmit={handleSaveDetails} className="mt-3 space-y-3">
              <input
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="Breed, e.g. Kenbro"
                className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Company (hatchery), e.g. Kenchic"
                className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Source of birds, e.g. Kikuyu Agrovet"
                className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="Breed" value={flock.breed} />
              <Row label="Company" value={flock.supplier} />
              <Row label="Source" value={flock.source} />
            </dl>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink-soft">Feed efficiency</p>
          <dl className="mt-2 space-y-1 text-sm">
            <Row
              label="Feed per bird per day"
              value={feedEfficiency.gramsPerBirdPerDay != null ? `${feedEfficiency.gramsPerBirdPerDay.toFixed(0)} g` : null}
            />
            <Row
              label="Feed per dozen eggs (FCR)"
              value={feedEfficiency.feedPerDozenEggsKg != null ? `${feedEfficiency.feedPerDozenEggsKg.toFixed(2)} kg` : null}
            />
          </dl>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink-soft">Egg production forecast</p>
          {productionTrend.status === "ok" ? (
            <>
              <p className="mt-2 text-sm text-ink">{productionTrend.explanation}</p>
              <p className="mt-2 text-xs text-ink-faint">
                Projected next 7 days: ~{productionTrend.value.next7DayProjection} eggs · Confidence: {productionTrend.confidence}% ·
                Based on {productionTrend.dataUsed}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">{productionTrend.explanation}</p>
          )}
        </div>

        <h2 className="mt-6 text-sm font-medium text-ink-soft">Recent records</h2>
        <div className="mt-2 space-y-2">
          {records.length === 0 && (
            <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
              No records yet.
            </p>
          )}
          {records.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
              <p className="font-medium text-ink">
                {new Date(r.record_date).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <p className="mt-1 text-ink-faint">
                {r.eggs_collected != null && `${r.eggs_collected} eggs · `}
                {r.mortality > 0 && `${r.mortality} died · `}
                {r.feed_consumed_kg != null && `${r.feed_consumed_kg}kg feed`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Print / PDF report view ---------- */}
      <div className="hidden print:block print:text-black">
        <PrintHeader tenantName={tenantName} subtitle={farmName} title={`Flock Summary — ${flock.batch_code}`} />

        <PrintSection title="Batch details">
          <PrintRow label="Poultry type" value={poultryTypeName ?? "—"} />
          <PrintRow label="Breed" value={flock.breed ?? "—"} />
          <PrintRow label="Company (hatchery)" value={flock.supplier ?? "—"} />
          <PrintRow label="Source of birds" value={flock.source ?? "—"} />
          <PrintRow label="Date received" value={placedLabel} />
          <PrintRow label="Age" value={`${ageDays} days`} />
        </PrintSection>

        <PrintSection title="Production summary">
          <PrintRow label="Started with" value={`${flock.initial_quantity} birds`} />
          <PrintRow label="Alive now" value={`${flock.current_quantity} birds`} />
          <PrintRow label="Mortality" value={`${mortalityPct.toFixed(1)}%`} />
          <PrintRow label="Total eggs (recent period)" value={String(feedEfficiency.totalEggs)} />
          <PrintRow label="Total feed used (recent period)" value={`${feedEfficiency.totalFeedKg.toFixed(1)} kg`} />
          <PrintRow
            label="Feed per bird per day"
            value={feedEfficiency.gramsPerBirdPerDay != null ? `${feedEfficiency.gramsPerBirdPerDay.toFixed(0)} g` : "—"}
          />
          <PrintRow
            label="Feed conversion (kg feed / dozen eggs)"
            value={feedEfficiency.feedPerDozenEggsKg != null ? feedEfficiency.feedPerDozenEggsKg.toFixed(2) : "—"}
          />
        </PrintSection>

        <PrintSection title="Financial summary">
          <PrintRow label="Total revenue" value={formatMoney(finance.totalRevenueCents, currency)} />
          <PrintRow label="Total expenses" value={formatMoney(finance.totalExpensesCents, currency)} />
          <PrintRow
            label={finance.profitCents >= 0 ? "Estimated profit" : "Estimated loss"}
            value={formatMoney(Math.abs(finance.profitCents), currency)}
          />
        </PrintSection>

        <PrintSection title="Recent daily records">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/30 text-left">
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Eggs</th>
                <th className="py-1 pr-2">Deaths</th>
                <th className="py-1 pr-2">Feed (kg)</th>
                <th className="py-1">Sales</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-black/10">
                  <td className="py-1 pr-2">
                    {new Date(r.record_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </td>
                  <td className="py-1 pr-2">{r.eggs_collected ?? "—"}</td>
                  <td className="py-1 pr-2">{r.mortality}</td>
                  <td className="py-1 pr-2">{r.feed_consumed_kg ?? "—"}</td>
                  <td className="py-1">{formatMoney(r.sales_amount_cents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-raised p-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-0.5 font-medium text-ink">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-ink">{value || "Not set"}</dd>
    </div>
  );
}
