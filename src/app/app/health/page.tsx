import { getMyFarmerContext } from "@/lib/data/farmer";
import { getHealthEvents } from "@/lib/data/business";
import { HealthEventManager } from "@/components/app/health-event-manager";

export default async function HealthPage() {
  const context = await getMyFarmerContext();
  if (!context?.flock) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        No active flock yet.
      </div>
    );
  }

  const events = await getHealthEvents(context.flock.id);

  return (
    <HealthEventManager tenantId={context.tenant.id} flockId={context.flock.id} events={events} />
  );
}
