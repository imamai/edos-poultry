import { getMyFarmerContext, getAllFlocks } from "@/lib/data/farmer";
import { getRecentSales, getCustomers } from "@/lib/data/business";
import { lastNDaysRange } from "@/lib/data/reports";
import { createClient } from "@/lib/supabase/server";
import { SalesManager } from "@/components/app/sales-manager";

export default async function SalesPage() {
  const context = await getMyFarmerContext();
  if (!context) return null;

  const [flocks, sales, customers] = await Promise.all([
    getAllFlocks(context.farm.id),
    getRecentSales(context.tenant.id, 30),
    getCustomers(context.tenant.id),
  ]);

  // Quick daily total (the "Sales today" amount typed straight into Record
  // Today) has to cover every flock on this farm, not just whichever one
  // getMyFarmerContext() happens to default to — a farm with more than one
  // concurrent batch would otherwise silently undercount.
  const flockIds = flocks.map((f) => f.id);
  const range = lastNDaysRange(30);
  let quickTotal = 0;
  if (flockIds.length > 0) {
    const supabase = await createClient();
    const { data: records } = await supabase
      .from("poultryedos_daily_records")
      .select("sales_amount_cents")
      .in("flock_id", flockIds)
      .gte("record_date", range.from);
    quickTotal = (records ?? []).reduce((sum, r) => sum + (r.sales_amount_cents ?? 0), 0);
  }

  return (
    <SalesManager
      tenantId={context.tenant.id}
      flocks={flocks}
      defaultFlockId={context.flock?.id ?? null}
      currency={context.tenant.currency}
      quickDailyTotalCents={quickTotal}
      sales={sales}
      customers={customers}
      tenantName={context.tenant.name}
      farmName={context.farm.name}
    />
  );
}
