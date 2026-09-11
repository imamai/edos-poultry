import { redirect } from "next/navigation";
import { getMyFarmerContext, getAllFlocks } from "@/lib/data/farmer";
import { getCustomers } from "@/lib/data/business";
import { getQuotations } from "@/lib/data/quotations";
import { QuotationsManager } from "@/components/app/quotations-manager";

export default async function QuotationsPage() {
  const context = await getMyFarmerContext();
  if (!context) redirect("/onboarding");

  const [flocks, customers, quotations] = await Promise.all([
    getAllFlocks(context.farm.id),
    getCustomers(context.tenant.id),
    getQuotations(context.tenant.id),
  ]);

  return (
    <QuotationsManager
      tenantId={context.tenant.id}
      farmId={context.farm.id}
      tenantName={context.tenant.name}
      farmName={context.farm.name}
      flocks={flocks}
      defaultFlockId={context.flock?.id ?? null}
      currency={context.tenant.currency}
      customers={customers}
      quotations={quotations}
    />
  );
}
