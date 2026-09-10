import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getFarmersWithFarmCount, getPendingInvites, getTenantMembers } from "@/lib/data/network";
import { TeamManager } from "@/components/app/team-manager";

export default async function TeamPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner" && membership.role !== "admin") {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        Only owners and admins manage the team.
      </div>
    );
  }

  const [farmers, invites, members] = await Promise.all([
    getFarmersWithFarmCount(membership.tenant.id),
    getPendingInvites(membership.tenant.id),
    getTenantMembers(membership.tenant.id),
  ]);

  return (
    <TeamManager tenantId={membership.tenant.id} farmers={farmers} invites={invites} members={members} />
  );
}
