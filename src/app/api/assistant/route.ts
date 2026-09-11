import { NextResponse } from "next/server";
import { getMyMembership, getMyFarmerContext } from "@/lib/data/farmer";
import { answerQuestion, answerFreeform, ASSISTANT_QUESTIONS, type AssistantContext } from "@/lib/ai/assistant";

export async function POST(request: Request) {
  const membership = await getMyMembership();
  if (!membership) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { questionId?: string; freeform?: string } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const farmerContext = await getMyFarmerContext();
  const ctx: AssistantContext = {
    tenantId: membership.tenant.id,
    farmId: farmerContext?.farm.id ?? null,
    currency: membership.tenant.currency,
  };

  if (body.questionId) {
    const known = ASSISTANT_QUESTIONS.some((q) => q.id === body.questionId);
    if (!known) return NextResponse.json({ error: "unknown_question" }, { status: 400 });
    const answer = await answerQuestion(body.questionId, ctx);
    return NextResponse.json({ answer });
  }

  if (body.freeform) {
    // Ground the free-text question in the same deterministic facts every
    // canned question uses — the model only ever phrases these, it never
    // gets raw table access or invents its own numbers.
    const summaryParts = await Promise.all(
      ASSISTANT_QUESTIONS.filter((q) => !q.networkOnly || !ctx.farmId).map(async (q) => {
        const answer = await answerQuestion(q.id, ctx);
        return `${q.label} ${answer}`;
      }),
    );
    const result = await answerFreeform(body.freeform, summaryParts.join("\n"));
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.reason,
          message: result.reason === "not_configured" ? "Free-text questions aren't configured for this environment yet." : result.message,
        },
        { status: result.reason === "not_configured" ? 501 : 502 },
      );
    }
    return NextResponse.json({ answer: result.answer });
  }

  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}
