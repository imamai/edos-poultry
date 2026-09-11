import Link from "next/link";
import { getMyFarmerContext, resolveSelectedFlock } from "@/lib/data/farmer";
import { getHealthEvents } from "@/lib/data/business";
import { HealthEventManager } from "@/components/app/health-event-manager";
import { FlockSwitcher } from "@/components/app/flock-switcher";

export default async function HealthPage({
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

  const events = await getHealthEvents(flock.id);

  return (
    <div>
      <FlockSwitcher flocks={allFlocks} selectedId={flock.id} />
      <HealthEventManager key={flock.id} tenantId={context.tenant.id} flockId={flock.id} events={events} />
    </div>
  );
}
