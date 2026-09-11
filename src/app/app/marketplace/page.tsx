import { redirect } from "next/navigation";
import { getMyMembership, getMyFarmerContext, getAllFlocks } from "@/lib/data/farmer";
import { getMyListings, browseListings } from "@/lib/data/marketplace";
import { MarketplaceManager } from "@/components/app/marketplace-manager";
import { MarketplaceBoard } from "@/components/marketplace-board";

export default async function MarketplacePage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const [farmerContext, listings] = await Promise.all([getMyFarmerContext(), browseListings()]);

  const canPost = farmerContext && (membership.role === "owner" || membership.role === "admin" || membership.role === "farmer");
  const flocks = farmerContext ? await getAllFlocks(farmerContext.farm.id) : [];
  const myListings = canPost ? await getMyListings(membership.tenant.id) : [];

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Marketplace</h1>
      <p className="mt-1 text-sm text-ink-soft">List eggs, birds, manure, or a feed request — visible publicly, no buyer sign-in required.</p>

      {canPost && farmerContext ? (
        <div className="mt-5">
          <MarketplaceManager
            tenantId={membership.tenant.id}
            farmId={farmerContext.farm.id}
            flocks={flocks}
            defaultContactName={farmerContext.farmer.full_name}
            defaultContactPhone={farmerContext.farmer.phone ?? ""}
            listings={myListings}
          />
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
          Add a farm to your account to start listing.
        </p>
      )}

      <h2 className="mt-8 text-sm font-medium text-ink-soft">Browse the marketplace</h2>
      <div className="mt-3">
        <MarketplaceBoard listings={listings} />
      </div>
    </div>
  );
}
