import { getMyFarmerContext } from "@/lib/data/farmer";
import { createClient } from "@/lib/supabase/server";
import { MedicationManager } from "@/components/app/medication-manager";
import type { MedicationRecord } from "@/lib/database.types";

export default async function MedicationsPage() {
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
    .from("poultryedos_medication_records")
    .select("*")
    .eq("flock_id", context.flock.id)
    .order("given_date", { ascending: false });

  return <MedicationManager tenantId={context.tenant.id} flockId={context.flock.id} records={(data ?? []) as MedicationRecord[]} />;
}
