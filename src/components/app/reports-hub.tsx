"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { downloadCsv } from "@/lib/csv";
import { downloadSimpleReportPdf } from "@/lib/pdf/simple-report";
import type { FinancialReport, MortalityReport, ProductionReport, ReportRange } from "@/lib/data/reports";

export function ReportsHub({
  tenantName,
  currency,
  selectedDays,
  range,
  production,
  mortality,
  financial,
}: {
  tenantName: string;
  currency: string;
  selectedDays: number;
  range: ReportRange;
  production: ProductionReport;
  mortality: MortalityReport;
  financial: FinancialReport;
}) {
  const router = useRouter();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Reports</h1>

      <div className="mt-3 flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => router.push(`/app/reports?range=${d}`)}
            className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${
              selectedDays === d ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      <ReportCard
        title="Production summary"
        subtitle={`${range.label} · ${production.totalEggs} eggs · ${production.totalFeedKg.toFixed(1)} kg feed · ${production.totalMortality} deaths`}
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
            subtitle: range.label,
            filename: `production-${range.from}-to-${range.to}.pdf`,
            sections: [
              {
                title: "Totals",
                rows: [
                  ["Eggs collected", String(production.totalEggs)],
                  ["Feed used", `${production.totalFeedKg.toFixed(1)} kg`],
                  ["Mortality", String(production.totalMortality)],
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
      />

      <ReportCard
        title="Mortality summary"
        subtitle={`${range.label} · ${mortality.totalMortality} deaths across ${mortality.rows.length} flock(s)`}
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
            subtitle: range.label,
            filename: `mortality-${range.from}-to-${range.to}.pdf`,
            sections: [{ title: "Totals", rows: [["Total mortality", String(mortality.totalMortality)]] }],
            table: {
              title: "By flock",
              head: ["Batch", "Mortality", "Current quantity"],
              body: mortality.rows.map((r) => [r.batchCode, r.mortality, r.currentQuantity]),
            },
          })
        }
      />

      <ReportCard
        title="Financial summary"
        subtitle={`${range.label} · ${formatMoney(financial.profitCents, currency)} ${financial.profitCents >= 0 ? "profit" : "loss"}`}
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
            subtitle: range.label,
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
      />
    </div>
  );
}

function ReportCard({
  title,
  subtitle,
  onPdf,
  onCsv,
}: {
  title: string;
  subtitle: string;
  onPdf: () => void;
  onCsv: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-4">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-faint">{subtitle}</p>
      <div className="mt-3 flex gap-2">
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
    </div>
  );
}
