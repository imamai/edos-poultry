import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/data/onboarding";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const state = await getOnboardingState();
  if (state.flock) redirect("/app/home");

  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col px-5 py-10 sm:px-8">
      <OnboardingWizard initial={state} />
    </div>
  );
}
