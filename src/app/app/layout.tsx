import { redirect } from "next/navigation";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { getMyMembership, getMyFarmerContext } from "@/lib/data/farmer";
import { ensureDueNotifications, getUnreadNotificationCount } from "@/lib/data/notifications";
import { isSuperAdmin } from "@/lib/data/super-admin";
import { OfflineProvider } from "@/lib/offline/offline-context";
import { OfflineBadge } from "@/components/app/offline-badge";
import { NotificationBell } from "@/components/app/notification-bell";
import { BottomNav, type NavVariant } from "@/components/app/bottom-nav";
import { SignOutLink } from "@/components/app/sign-out-link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const farmerContext = await getMyFarmerContext();

  // No cron/background worker in this app — notifications are generated
  // lazily, once per layout render, then read back so the bell's count
  // reflects anything just created. Both are best-effort (see
  // ensureDueNotifications) and must never block rendering the app shell.
  await ensureDueNotifications(membership, farmerContext);
  const unreadCount = await getUnreadNotificationCount(membership.userId);

  const variant: NavVariant = farmerContext
    ? "farmer"
    : membership.role === "field_officer"
      ? "field"
      : "admin";

  const title = farmerContext?.farm.name ?? membership.tenant.name;

  // Every variant collapses back down to the same tested phone-narrow
  // column on an actual phone — these max-widths are only an upper bound.
  // Above phone width, farmers get a comfortable, still-simple column
  // (spec §6's "simple input" stays simple, it just isn't stretched thin
  // across a monitor); admin/field roles — the ones actually running a
  // network from a PC (spec §65: "Desktop is the expanded experience") —
  // get noticeably more room for Network/Team/Reports. The super admin
  // gets the wide layout unconditionally, even if he also has his own
  // farmer profile (variant would otherwise be "farmer"/narrow) — he's
  // on a PC the large majority of the time reviewing the Super Admin
  // table, per the user's own note.
  const wide = variant !== "farmer" || (await isSuperAdmin());
  const containerClass = wide ? "max-w-md md:max-w-2xl lg:max-w-5xl" : "max-w-md md:max-w-xl lg:max-w-2xl";

  return (
    <OfflineProvider>
      <div className="flex min-h-screen flex-col pb-20 print:pb-0">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 px-5 py-3 backdrop-blur print:hidden">
          <div className={`mx-auto flex items-center justify-between ${containerClass}`}>
            <span className="font-display text-lg font-medium text-ink">{title}</span>
            <div className="flex items-center gap-3">
              <OfflineBadge />
              <NotificationBell unreadCount={unreadCount} />
              <Link href="/app/help" aria-label="Get help" className="text-ink-soft hover:text-primary">
                <LifeBuoy className="h-5 w-5" />
              </Link>
              <SignOutLink />
            </div>
          </div>
        </header>
        <main className={`mx-auto w-full flex-1 px-5 py-5 print:max-w-none print:px-0 ${containerClass}`}>{children}</main>
        <div className="print:hidden">
          <BottomNav variant={variant} containerClass={containerClass} locale={membership.tenant.locale} />
        </div>
      </div>
    </OfflineProvider>
  );
}
