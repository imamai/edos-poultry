import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getPoultryTypes } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { NewFlockForm } from "@/components/app/new-flock-form";

export default async function NewFlockPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const { data: farm } = await supabase
    .from("poultryedos_farms")
    .select("id")
    .eq("tenant_id", membership.tenant.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!farm) redirect("/onboarding");

  const [poultryTypes, { data: house }] = await Promise.all([
    getPoultryTypes(membership.tenant.id),
    supabase.from("poultryedos_houses").select("id").eq("farm_id", farm.id).order("created_at").limit(1).maybeSingle(),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Add a flock</h1>
      <NewFlockForm
        tenantId={membership.tenant.id}
        farmId={farm.id}
        houseId={house?.id ?? null}
        poultryTypes={poultryTypes}
      />
    </div>
  );
}
