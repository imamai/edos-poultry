import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getNotifications } from "@/lib/data/notifications";
import { DecisionCenter } from "@/components/app/decision-center";

export default async function DecisionsPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const notifications = await getNotifications(membership.userId, 50);

  return <DecisionCenter notifications={notifications} />;
}
