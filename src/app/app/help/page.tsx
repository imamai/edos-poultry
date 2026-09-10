import { getMyFarmerContext } from "@/lib/data/farmer";
import { HelpRequestForm } from "@/components/app/help-request-form";

export default async function HelpPage() {
  const context = await getMyFarmerContext();
  if (!context) return null;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">I need help</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Tell us what&apos;s going on and we&apos;ll follow up.
      </p>
      <HelpRequestForm tenantId={context.tenant.id} farmerId={context.farmer.id} flockId={context.flock?.id ?? null} />
    </div>
  );
}
