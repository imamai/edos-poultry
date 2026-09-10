import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getFieldVisits, getAssignedFarmers } from "@/lib/data/network";
import { VisitManager } from "@/components/app/visit-manager";

export default async function FieldVisitsPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const [visits, farmers] = await Promise.all([
    getFieldVisits({ fieldOfficerUserId: membership.userId }),
    getAssignedFarmers(membership.userId),
  ]);

  return (
    <VisitManager
      tenantId={membership.tenant.id}
      fieldOfficerUserId={membership.userId}
      visits={visits}
      farmers={farmers}
    />
  );
}
