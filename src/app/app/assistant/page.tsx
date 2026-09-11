import { redirect } from "next/navigation";
import { getMyMembership, getMyFarmerContext } from "@/lib/data/farmer";
import { isAssistantLlmConfigured, ASSISTANT_QUESTIONS } from "@/lib/ai/assistant";
import { AiAssistant } from "@/components/app/ai-assistant";

export default async function AssistantPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const farmerContext = await getMyFarmerContext();
  const isOwnerOrAdmin = membership.role === "owner" || membership.role === "admin";

  const questions = ASSISTANT_QUESTIONS.filter((q) => !q.networkOnly || isOwnerOrAdmin);

  return (
    <AiAssistant
      questions={questions}
      llmConfigured={isAssistantLlmConfigured()}
      hasFarm={Boolean(farmerContext?.farm)}
    />
  );
}
