import Link from "next/link";
import { getMyFarmerContext, resolveSelectedFlock } from "@/lib/data/farmer";
import { createClient } from "@/lib/supabase/server";
import { MedicationManager } from "@/components/app/medication-manager";
import { FlockSwitcher } from "@/components/app/flock-switcher";
import type { MedicationRecord } from "@/lib/database.types";

export default async function MedicationsPage({
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

  const supabase = await createClient();
  const { data } = await supabase
    .from("poultryedos_medication_records")
    .select("*")
    .eq("flock_id", flock.id)
    .order("given_date", { ascending: false });

  return (
    <div>
      <FlockSwitcher flocks={allFlocks} selectedId={flock.id} />
      <MedicationManager
        key={flock.id}
        tenantId={context.tenant.id}
        flockId={flock.id}
        records={(data ?? []) as MedicationRecord[]}
      />
    </div>
  );
}
