import { getMyFarmerContext, getRecentDailyRecords } from "@/lib/data/farmer";
import { getRecentSales, getCustomers } from "@/lib/data/business";
import { SalesManager } from "@/components/app/sales-manager";

export default async function SalesPage() {
  const context = await getMyFarmerContext();
  if (!context) return null;

  const [records, sales, customers] = await Promise.all([
    context.flock ? getRecentDailyRecords(context.flock.id, 30) : Promise.resolve([]),
    getRecentSales(context.tenant.id, 30),
    getCustomers(context.tenant.id),
  ]);

  const quickTotal = records.reduce((sum, r) => sum + r.sales_amount_cents, 0);

  return (
    <SalesManager
      tenantId={context.tenant.id}
      flockId={context.flock?.id ?? null}
      currency={context.tenant.currency}
      quickDailyTotalCents={quickTotal}
      sales={sales}
      customers={customers}
      tenantName={context.tenant.name}
      farmName={context.farm.name}
    />
  );
}
