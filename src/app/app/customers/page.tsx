import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getCustomers } from "@/lib/data/business";
import { CustomersManager } from "@/components/app/customers-manager";

export default async function CustomersPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const customers = await getCustomers(membership.tenant.id);

  return <CustomersManager tenantId={membership.tenant.id} customers={customers} />;
}
