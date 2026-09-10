import { redirect } from "next/navigation";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { getMyMembership, getMyFarmerContext } from "@/lib/data/farmer";
import { OfflineProvider } from "@/lib/offline/offline-context";
import { OfflineBadge } from "@/components/app/offline-badge";
import { BottomNav, type NavVariant } from "@/components/app/bottom-nav";
import { SignOutLink } from "@/components/app/sign-out-link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const farmerContext = await getMyFarmerContext();

  const variant: NavVariant = farmerContext
    ? "farmer"
    : membership.role === "field_officer"
      ? "field"
      : "admin";

  const title = farmerContext?.farm.name ?? membership.tenant.name;

  return (
    <OfflineProvider>
      <div className="flex min-h-screen flex-col pb-20 print:pb-0">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 px-5 py-3 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <span className="font-display text-lg font-medium text-ink">{title}</span>
            <div className="flex items-center gap-3">
              <OfflineBadge />
              <Link href="/app/help" aria-label="Get help" className="text-ink-soft hover:text-primary">
                <LifeBuoy className="h-5 w-5" />
              </Link>
              <SignOutLink />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-5 py-5 print:max-w-none print:px-0">{children}</main>
        <div className="print:hidden">
          <BottomNav variant={variant} />
        </div>
      </div>
    </OfflineProvider>
  );
}
