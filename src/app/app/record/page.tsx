import { getMyFarmerContext, getTodayRecord } from "@/lib/data/farmer";
import { RecordTodayForm } from "@/components/app/record-today-form";

export default async function RecordTodayPage() {
  const context = await getMyFarmerContext();
  if (!context?.flock) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        No active flock to record against yet.
      </div>
    );
  }

  const existing = await getTodayRecord(context.flock.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Record today</h1>
      <p className="mt-1 text-sm text-ink-soft">{context.flock.batch_code}</p>
      <RecordTodayForm tenantId={context.tenant.id} flockId={context.flock.id} existing={existing} />
    </div>
  );
}
