import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getNotifications } from "@/lib/data/notifications";
import { NotificationList } from "@/components/app/notification-list";

export default async function NotificationsPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const notifications = await getNotifications(membership.userId);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Notifications</h1>
      <NotificationList notifications={notifications} />
    </div>
  );
}
