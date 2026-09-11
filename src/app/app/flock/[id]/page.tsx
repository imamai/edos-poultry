import { notFound, redirect } from "next/navigation";
import { getMyMembership, getFlockById, getRecentDailyRecords } from "@/lib/data/farmer";
import { getFlockFinance } from "@/lib/data/business";
import { createClient } from "@/lib/supabase/server";
import { computeFeedEfficiency } from "@/lib/feed-efficiency";
import { predictProductionTrend } from "@/lib/ai/predictions";
import { FlockDetail } from "@/components/app/flock-detail";

export default async function FlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const flock = await getFlockById(id);
  if (!flock) notFound(); // RLS already scopes this to the caller's tenant

  const supabase = await createClient();
  const { data: poultryType } = flock.poultry_type_id
    ? await supabase.from("poultryedos_poultry_types").select("name").eq("id", flock.poultry_type_id).maybeSingle()
    : { data: null };
  const { data: farm } = await supabase.from("poultryedos_farms").select("name").eq("id", flock.farm_id).maybeSingle();

  const records = await getRecentDailyRecords(flock.id, 60);
  const feedEfficiency = computeFeedEfficiency(records, flock.current_quantity);
  const finance = await getFlockFinance(flock.id);
  const productionTrend = predictProductionTrend(records);

  return (
    <FlockDetail
      flock={flock}
      poultryTypeName={poultryType?.name ?? null}
      farmName={farm?.name ?? ""}
      tenantName={membership.tenant.name}
      records={records.slice(0, 14)}
      feedEfficiency={feedEfficiency}
      finance={finance}
      currency={membership.tenant.currency}
      productionTrend={productionTrend}
    />
  );
}
