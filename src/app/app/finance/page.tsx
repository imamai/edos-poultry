import Link from "next/link";
import { getMyFarmerContext, resolveSelectedFlock } from "@/lib/data/farmer";
import { getFlockFinance } from "@/lib/data/business";
import { formatMoney } from "@/lib/money";
import { FlockSwitcher } from "@/components/app/flock-switcher";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ flock?: string }>;
}) {
  const context = await getMyFarmerContext();
  const { flock: requestedFlockId } = await searchParams;
  if (!context) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        No active flock yet.
      </div>
    );
  }

  const { flock, allFlocks } = await resolveSelectedFlock(context.farm.id, requestedFlockId);
  if (!flock) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        No active flock yet.
        <br />
        <Link href="/app/flock/new" className="mt-2 inline-block text-primary hover:underline">
          Add a flock →
        </Link>
      </div>
    );
  }

  const { tenant } = context;
  const finance = await getFlockFinance(flock.id);
  const isProfit = finance.profitCents >= 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Finance</h1>
      <p className="mt-1 text-sm text-ink-soft">{flock.batch_code}</p>
      <div className="mt-3">
        <FlockSwitcher flocks={allFlocks} selectedId={flock.id} />
      </div>

      <div className={`mt-4 rounded-2xl border p-5 text-center ${isProfit ? "border-success bg-success-soft" : "border-danger bg-danger-soft"}`}>
        <p className={`text-xs ${isProfit ? "text-success" : "text-danger"}`}>
          {isProfit ? "Estimated profit" : "Estimated loss"}
        </p>
        <p className={`mt-1 font-display text-3xl font-medium ${isProfit ? "text-success" : "text-danger"}`}>
          {formatMoney(Math.abs(finance.profitCents), tenant.currency)}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <Row label="Revenue — quick daily totals" value={formatMoney(finance.revenueQuickSalesCents, tenant.currency)} />
        <Row label="Revenue — itemized sales" value={formatMoney(finance.revenueItemizedSalesCents, tenant.currency)} />
        <Row label="Total revenue" value={formatMoney(finance.totalRevenueCents, tenant.currency)} strong />
        <Row label="Total expenses" value={formatMoney(finance.totalExpensesCents, tenant.currency)} />
        <Row label="Birds sold or lost" value={String(finance.birdsSoldOrLost)} />
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Revenue counts both the quick daily sales total (Record Today) and any itemized sales you&apos;ve logged, so nothing is double-counted or missed.
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
      <span className={strong ? "font-medium text-ink" : "text-ink-soft"}>{label}</span>
      <span className={strong ? "font-display text-lg font-medium text-ink" : "font-medium text-ink"}>{value}</span>
    </div>
  );
}
