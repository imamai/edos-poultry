import Link from "next/link";
import { getMyFarmerContext, getTodayRecord, resolveSelectedFlock } from "@/lib/data/farmer";
import { RecordTodayForm } from "@/components/app/record-today-form";
import { FlockSwitcher } from "@/components/app/flock-switcher";

export default async function RecordTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ flock?: string }>;
}) {
  const context = await getMyFarmerContext();
  const { flock: requestedFlockId } = await searchParams;

  if (!context) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        No active flock to record against yet.
      </div>
    );
  }

  const { flock, allFlocks } = await resolveSelectedFlock(context.farm.id, requestedFlockId);

  if (!flock) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        No active flock to record against yet.
        <br />
        <Link href="/app/flock/new" className="mt-2 inline-block text-primary hover:underline">
          Add a flock →
        </Link>
      </div>
    );
  }

  const existing = await getTodayRecord(flock.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Record today</h1>
      <p className="mt-1 text-sm text-ink-soft">{flock.batch_code}</p>
      <FlockSwitcher flocks={allFlocks} selectedId={flock.id} />
      <RecordTodayForm key={flock.id} tenantId={context.tenant.id} flockId={flock.id} existing={existing} />
    </div>
  );
}
