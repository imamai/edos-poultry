import { notFound, redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getFarmerDetail } from "@/lib/data/network";
import { FarmerDetailView } from "@/components/app/farmer-detail";

export default async function FarmerDetailPage({ params }: { params: Promise<{ farmerId: string }> }) {
  const { farmerId } = await params;
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner" && membership.role !== "admin") {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        Only owners and admins see this.
      </div>
    );
  }

  const detail = await getFarmerDetail(farmerId, membership.tenant.id);
  if (!detail) notFound(); // scoped to this tenant inside getFarmerDetail

  return <FarmerDetailView detail={detail} currency={membership.tenant.currency} />;
}
