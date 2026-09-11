import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { isSuperAdmin, listAllTenants } from "@/lib/data/super-admin";
import { SuperAdminDashboard } from "@/components/app/super-admin-dashboard";

export default async function SuperAdminPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const superAdmin = await isSuperAdmin();
  if (!superAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        You don&apos;t have access to this.
      </div>
    );
  }

  const tenants = await listAllTenants();

  return <SuperAdminDashboard tenants={tenants} />;
}
