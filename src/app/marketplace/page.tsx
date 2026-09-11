import Link from "next/link";
import { browseListings } from "@/lib/data/marketplace";
import { MarketplaceBoard } from "@/components/marketplace-board";

export default async function PublicMarketplacePage() {
  const listings = await browseListings();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Poultry360 Marketplace</h1>
          <p className="mt-1 text-sm text-ink-soft">Eggs, birds, manure, and feed requests from farmers on EDOS Poultry360.</p>
        </div>
        <Link
          href="/signup"
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
        >
          List something
        </Link>
      </div>

      <div className="mt-6">
        <MarketplaceBoard listings={listings} />
      </div>

      <p className="mt-8 text-center text-xs text-ink-faint">
        Already a farmer here?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>{" "}
        to manage your own listings.
      </p>
    </div>
  );
}
