"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { downloadCsv } from "@/lib/csv";
import { downloadSimpleReportPdf } from "@/lib/pdf/simple-report";
import type { FinancialReport, MortalityReport, ProductionReport, ReportRange, TenantFlockOption } from "@/lib/data/reports";

interface Suggestion {
  body: string;
  flockId: string | null;
}

export function ReportsHub({
  tenantName,
  currency,
  selectedDays,
  customFrom,
  customTo,
  range,
  flocks,
  selectedFlockId,
  production,
  mortality,
  financial,
  suggestion,
}: {
  tenantName: string;
  currency: string;
  selectedDays: number;
  customFrom?: string;
  customTo?: string;
  range: ReportRange;
  flocks: TenantFlockOption[];
  selectedFlockId: string | null;
  production: ProductionReport;
  mortality: MortalityReport;
  financial: FinancialReport;
  suggestion: Suggestion | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showCustom, setShowCustom] = useState(Boolean(customFrom && customTo));
  const [fromDraft, setFromDraft] = useState(customFrom ?? "");
  const [toDraft, setToDraft] = useState(customTo ?? "");
  const [viewing, setViewing] = useState<"production" | "mortality" | "financial" | null>(null);

  function navigate(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`/app/reports?${params.toString()}`);
  }

  function selectRange(days: number) {
    setShowCustom(false);
    navigate({ range: String(days), from: null, to: null });
  }

  function applyCustomRange() {
    if (!fromDraft || !toDraft) return;
    navigate({ from: fromDraft, to: toDraft, range: null });
  }

  function selectFlock(flockId: string) {
    navigate({ flock: flockId || null });
  }

  const selectedFlock = selectedFlockId ? flocks.find((f) => f.id === selectedFlockId) ?? null : null;
  const filterSummary = `${selectedFlock ? selectedFlock.batchCode : "All batches"} · ${range.label}`;

  // Per-batch-only metrics -- meaningless averaged across batches of
  // different sizes/ages, so these tiles only appear when one is
  // selected (see the plan's reasoning: no fabricated tenant-wide average).
  const mortalityRatePct =
    selectedFlock && selectedFlock.initialQuantity > 0 ? (mortality.totalMortality / selectedFlock.initialQuantity) * 100 : null;
  const profitPerBirdCents =
    selectedFlock && selectedFlock.initialQuantity > 0 ? Math.round(financial.profitCents / selectedFlock.initialQuantity) : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Reports</h1>

      {/* ---------- Filters ---------- */}
      <div className="mt-4 space-y-3 rounded-2xl border border-line bg-paper-raised p-4">
        {flocks.length > 0 && (
          <div>
            <label className="text-xs font-medium text-ink-faint">Batch</label>
            <select
              value={selectedFlockId ?? ""}
              onChange={(e) => selectFlock(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">All batches</option>
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.batchCode} {f.status !== "active" ? `(${f.status.replace("_", " ")})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-ink-faint">Period</label>
          <div className="mt-1 flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => selectRange(d)}
                className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${
                  !showCustom && selectedDays === d ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
                }`}
              >
                {d}d
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${
                showCustom ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
              }`}
            >
              Custom
            </button>
          </div>
          {showCustom && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                value={fromDraft}
                onChange={(e) => setFromDraft(e.target.value)}
                className="flex-1 rounded-lg border border-line-strong px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              <span className="text-xs text-ink-faint">to</span>
              <input
                type="date"
                value={toDraft}
                onChange={(e) => setToDraft(e.target.value)}
                className="flex-1 rounded-lg border border-line-strong px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={applyCustomRange}
                disabled={!fromDraft || !toDraft}
                className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Worth checking ---------- */}
      {suggestion && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm text-accent-dark">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Worth checking</p>
            <p className="mt-0.5">{suggestion.body}</p>
            {suggestion.flockId && (
              <Link href={`/app/reports?flock=${suggestion.flockId}`} className="mt-1 inline-block underline">
                View that batch&apos;s reports
              </Link>
            )}
          </div>
        </div>
      )}
      {!suggestion && (
        <p className="mt-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-faint">
          New here? The Financial Summary below is the fastest way to see if you&apos;re profitable this period.
        </p>
      )}

      {/* ---------- Analytics ---------- */}
      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-ink-faint">Analytics · {filterSummary}</p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Eggs" value={String(production.totalEggs)} />
        <Tile label="Feed used" value={`${production.totalFeedKg.toFixed(1)} kg`} />
        <Tile label="Mortality" value={String(production.totalMortality)} />
        <Tile label="Feed / dozen eggs" value={production.feedPerDozenEggsKg != null ? `${production.feedPerDozenEggsKg.toFixed(2)} kg` : "—"} />
        <Tile label="Revenue" value={formatMoney(financial.revenueCents, currency)} />
        <Tile label="Expenses" value={formatMoney(financial.expensesCents, currency)} />
        <Tile label={financial.profitCents >= 0 ? "Profit" : "Loss"} value={formatMoney(Math.abs(financial.profitCents), currency)} />
        {mortalityRatePct != null && <Tile label="Mortality rate" value={`${mortalityRatePct.toFixed(1)}%`} />}
        {profitPerBirdCents != null && <Tile label="Profit / bird placed" value={formatMoney(profitPerBirdCents, currency)} />}
      </div>

      {/* ---------- Production ---------- */}
      <ReportCard
        title="Production summary"
        subtitle={`${production.totalEggs} eggs · ${production.totalFeedKg.toFixed(1)} kg feed · ${production.totalMortality} deaths`}
        viewing={viewing === "production"}
        onToggleView={() => setViewing(viewing === "production" ? null : "production")}
        onCsv={() =>
          downloadCsv(
            `production-${range.from}-to-${range.to}.csv`,
            ["Date", "Eggs", "Feed (kg)", "Mortality"],
            production.rows.map((r) => [r.date, r.eggs, r.feedKg, r.mortality]),
          )
        }
        onPdf={() =>
          downloadSimpleReportPdf({
            tenantName,
            title: "Production Report",
            subtitle: `${filterSummary}`,
            filename: `production-${range.from}-to-${range.to}.pdf`,
            sections: [
              {
                title: "Totals",
                rows: [
                  ["Eggs collected", String(production.totalEggs)],
                  ["Feed used", `${production.totalFeedKg.toFixed(1)} kg`],
                  ["Mortality", String(production.totalMortality)],
                  ["Feed per dozen eggs", production.feedPerDozenEggsKg != null ? `${production.feedPerDozenEggsKg.toFixed(2)} kg` : "—"],
                ],
              },
            ],
            table: {
              title: "By day",
              head: ["Date", "Eggs", "Feed (kg)", "Mortality"],
              body: production.rows.map((r) => [r.date, r.eggs, r.feedKg, r.mortality]),
            },
          })
        }
      >
        <SimpleTable head={["Date", "Eggs", "Feed (kg)", "Mortality"]} rows={production.rows.map((r) => [r.date, r.eggs, r.feedKg.toFixed(1), r.mortality])} />
      </ReportCard>

      {/* ---------- Mortality ---------- */}
      <ReportCard
        title="Mortality summary"
        subtitle={`${mortality.totalMortality} deaths across ${mortality.rows.length} flock(s)`}
        viewing={viewing === "mortality"}
        onToggleView={() => setViewing(viewing === "mortality" ? null : "mortality")}
        onCsv={() =>
          downloadCsv(
            `mortality-${range.from}-to-${range.to}.csv`,
            ["Batch", "Mortality", "Current quantity"],
            mortality.rows.map((r) => [r.batchCode, r.mortality, r.currentQuantity]),
          )
        }
        onPdf={() =>
          downloadSimpleReportPdf({
            tenantName,
            title: "Mortality Report",
            subtitle: filterSummary,
            filename: `mortality-${range.from}-to-${range.to}.pdf`,
            sections: [
              {
                title: "Totals",
                rows: [
                  ["Total mortality", String(mortality.totalMortality)],
                  ...(mortalityRatePct != null ? [["Mortality rate", `${mortalityRatePct.toFixed(1)}%`] as [string, string]] : []),
                ],
              },
            ],
            table: {
              title: "By flock",
              head: ["Batch", "Mortality", "Current quantity"],
              body: mortality.rows.map((r) => [r.batchCode, r.mortality, r.currentQuantity]),
            },
          })
        }
      >
        <SimpleTable head={["Batch", "Mortality", "Current qty"]} rows={mortality.rows.map((r) => [r.batchCode, r.mortality, r.currentQuantity])} />
      </ReportCard>

      {/* ---------- Financial ---------- */}
      <ReportCard
        title="Financial summary"
        subtitle={`${formatMoney(financial.profitCents, currency)} ${financial.profitCents >= 0 ? "profit" : "loss"}`}
        viewing={viewing === "financial"}
        onToggleView={() => setViewing(viewing === "financial" ? null : "financial")}
        onCsv={() =>
          downloadCsv(
            `financial-${range.from}-to-${range.to}.csv`,
            ["Category", "Amount"],
            financial.expensesByCategory.map((r) => [r.category, (r.amountCents / 100).toFixed(2)]),
          )
        }
        onPdf={() =>
          downloadSimpleReportPdf({
            tenantName,
            title: "Financial Report",
            subtitle: filterSummary,
            filename: `financial-${range.from}-to-${range.to}.pdf`,
            sections: [
              {
                title: "Summary",
                rows: [
                  ["Revenue", formatMoney(financial.revenueCents, currency)],
                  ["Expenses", formatMoney(financial.expensesCents, currency)],
                  [financial.profitCents >= 0 ? "Profit" : "Loss", formatMoney(Math.abs(financial.profitCents), currency)],
                ],
              },
            ],
            table: {
              title: "Expenses by category",
              head: ["Category", "Amount"],
              body: financial.expensesByCategory.map((r) => [r.category, formatMoney(r.amountCents, currency)]),
            },
          })
        }
      >
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Revenue by product</p>
        <SimpleTable head={["Product", "Amount"]} rows={financial.revenueByProduct.map((r) => [r.category, formatMoney(r.amountCents, currency)])} />
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-faint">Expenses by category</p>
        <SimpleTable head={["Category", "Amount"]} rows={financial.expensesByCategory.map((r) => [r.category, formatMoney(r.amountCents, currency)])} />
        {financial.topCustomers.length > 0 && (
          <>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-faint">Top customers</p>
            <SimpleTable head={["Customer", "Amount"]} rows={financial.topCustomers.map((r) => [r.customerName, formatMoney(r.amountCents, currency)])} />
          </>
        )}
      </ReportCard>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-raised p-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-lg font-medium text-ink">{value}</p>
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="py-3 text-center text-xs text-ink-faint">No data for this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="mt-1 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-faint">
            {head.map((h) => (
              <th key={h} className="py-1.5 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-1.5 pr-3 text-ink-soft">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportCard({
  title,
  subtitle,
  viewing,
  onToggleView,
  onPdf,
  onCsv,
  children,
}: {
  title: string;
  subtitle: string;
  viewing: boolean;
  onToggleView: () => void;
  onPdf: () => void;
  onCsv: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-4">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-faint">{subtitle}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleView}
          className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
        >
          {viewing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {viewing ? "Hide" : "View"}
        </button>
        <button
          type="button"
          onClick={onPdf}
          className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
        >
          <Download className="h-4 w-4" /> PDF
        </button>
        <button
          type="button"
          onClick={onCsv}
          className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>
      {viewing && <div className="mt-3 border-t border-line pt-3">{children}</div>}
    </div>
  );
}
