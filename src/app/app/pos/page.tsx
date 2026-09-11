import { redirect } from "next/navigation";
import { getMyFarmerContext, getAllFlocks } from "@/lib/data/farmer";
import { getCustomers } from "@/lib/data/business";
import { PosManager } from "@/components/app/pos-manager";

export default async function PosPage() {
  const context = await getMyFarmerContext();
  if (!context) redirect("/onboarding");

  const [flocks, customers] = await Promise.all([getAllFlocks(context.farm.id), getCustomers(context.tenant.id)]);

  return (
    <PosManager
      tenantId={context.tenant.id}
      tenantName={context.tenant.name}
      farmName={context.farm.name}
      flocks={flocks}
      defaultFlockId={context.flock?.id ?? null}
      currency={context.tenant.currency}
      customers={customers}
    />
  );
}
