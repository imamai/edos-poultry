import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getMyTasks, getAllTenantTasks, getFieldOfficers, getFarmersWithFarmCount } from "@/lib/data/network";
import { TaskManager } from "@/components/app/task-manager";

export default async function TasksPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  const [myTasks, allTasks, officers, farmers] = await Promise.all([
    getMyTasks(membership.userId),
    isAdmin ? getAllTenantTasks(membership.tenant.id) : Promise.resolve([]),
    isAdmin ? getFieldOfficers(membership.tenant.id) : Promise.resolve([]),
    isAdmin ? getFarmersWithFarmCount(membership.tenant.id) : Promise.resolve([]),
  ]);

  return (
    <TaskManager
      tenantId={membership.tenant.id}
      isAdmin={isAdmin}
      myTasks={myTasks}
      allTasks={allTasks}
      officers={officers}
      farmers={farmers}
    />
  );
}
