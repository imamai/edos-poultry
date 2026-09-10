import { getMyFarmerContext } from "@/lib/data/farmer";
import { getBiosecurityChecks } from "@/lib/data/business";
import { BiosecurityManager } from "@/components/app/biosecurity-manager";

export default async function BiosecurityPage() {
  const context = await getMyFarmerContext();
  if (!context) return null;

  const checks = await getBiosecurityChecks(context.farm.id);
  const today = new Date().toISOString().slice(0, 10);
  const todayCheck = checks.find((c) => c.check_date === today) ?? null;

  return (
    <BiosecurityManager tenantId={context.tenant.id} farmId={context.farm.id} checks={checks} todayCheck={todayCheck} />
  );
}
