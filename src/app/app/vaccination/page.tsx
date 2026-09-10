import { getMyFarmerContext } from "@/lib/data/farmer";
import { createClient } from "@/lib/supabase/server";
import { VaccinationManager } from "@/components/app/vaccination-manager";
import type { VaccinationSchedule } from "@/lib/database.types";

export default async function VaccinationPage() {
  const context = await getMyFarmerContext();
  if (!context?.flock) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        No active flock yet.
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("poultryedos_vaccination_schedules")
    .select("*")
    .eq("flock_id", context.flock.id)
    .order("scheduled_date", { ascending: false });

  return (
    <VaccinationManager
      tenantId={context.tenant.id}
      flockId={context.flock.id}
      placementDate={context.flock.placement_date}
      schedules={(data ?? []) as VaccinationSchedule[]}
    />
  );
}
