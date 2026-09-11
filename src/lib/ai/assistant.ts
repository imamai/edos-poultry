import { createClient } from "@/lib/supabase/server";
import { getAllFlocks, getRecentDailyRecords } from "@/lib/data/farmer";
import { getFlockFinance } from "@/lib/data/business";
import { getNetworkSummary } from "@/lib/data/network";
import { lastNDaysRange, getFinancialReport, getMortalityReport } from "@/lib/data/reports";
import { predictProductionTrend, predictFeedStockout } from "@/lib/ai/predictions";
import { formatMoney } from "@/lib/money";

// EDOS Poultry360 AI Assistant (spec §54) — tenant-aware Q&A, "grounded in
// actual tenant data" per the spec's own requirement. Every answer below
// is a real, deterministic calculation over the tenant's own rows — no
// language model is involved in producing the numbers. See
// isAssistantLlmConfigured()/answerFreeform() at the bottom for the
// separate, optional free-text mode, which only ever *phrases* these same
// computed facts, never invents its own.

export interface AssistantQuestion {
  id: string;
  label: string;
  /** true = only meaningful for a tenant with multiple farms/farmers (an
   * owner/admin without their own single farm context) */
  networkOnly?: boolean;
}

export const ASSISTANT_QUESTIONS: AssistantQuestion[] = [
  { id: "performance", label: "How is my farm performing?" },
  { id: "most_profitable_flock", label: "Which flock is most profitable?" },
  { id: "production_decline", label: "Why did egg production decline?" },
  { id: "feed_next_week", label: "How much feed will I need next week?" },
  { id: "biggest_expenses", label: "What are my biggest expenses?" },
  { id: "which_batch_to_sell", label: "Which batch should I sell?" },
  { id: "highest_mortality_farm", label: "Which farm has the highest mortality?", networkOnly: true },
];

export interface AssistantContext {
  tenantId: string;
  farmId: string | null; // null for an owner/admin with no farmer profile of their own
  currency: string;
}

export async function answerQuestion(questionId: string, ctx: AssistantContext): Promise<string> {
  switch (questionId) {
    case "performance":
      return answerPerformance(ctx);
    case "most_profitable_flock":
      return answerMostProfitableFlock(ctx);
    case "production_decline":
      return answerProductionDecline(ctx);
    case "feed_next_week":
      return answerFeedNextWeek(ctx);
    case "biggest_expenses":
      return answerBiggestExpenses(ctx);
    case "which_batch_to_sell":
      return answerWhichBatchToSell(ctx);
    case "highest_mortality_farm":
      return answerHighestMortalityFarm(ctx);
    default:
      return "I don't have an answer for that question yet.";
  }
}

async function answerPerformance({ tenantId, currency }: AssistantContext): Promise<string> {
  const summary = await getNetworkSummary(tenantId);
  if (summary.flockCount === 0) return "There's no active flock yet, so there's nothing to report on.";
  return (
    `Across ${summary.farmCount} farm(s) and ${summary.flockCount} active flock(s) totalling ${summary.totalBirds} birds: ` +
    `in the last 7 days you collected ${summary.eggs7d} eggs, recorded ${summary.mortality7d} death(s), and had ` +
    `${formatMoney(summary.sales7dCents, currency)} in sales against ${formatMoney(summary.expenses7dCents, currency)} in expenses.`
  );
}

async function answerMostProfitableFlock({ farmId, currency }: AssistantContext): Promise<string> {
  if (!farmId) return "I need a specific farm to compare flocks within — this question isn't set up for a network-wide view yet.";
  const flocks = await getAllFlocks(farmId);
  if (flocks.length === 0) return "There are no flocks yet to compare.";
  if (flocks.length === 1) return `${flocks[0].batch_code} is your only flock, so there's nothing to compare it against yet.`;

  const withFinance = await Promise.all(flocks.map(async (f) => ({ flock: f, finance: await getFlockFinance(f.id) })));
  const best = withFinance.reduce((a, b) => (b.finance.profitCents > a.finance.profitCents ? b : a));
  return `${best.flock.batch_code} is your most profitable flock, with an estimated profit of ${formatMoney(best.finance.profitCents, currency)}.`;
}

async function answerProductionDecline({ farmId }: AssistantContext): Promise<string> {
  if (!farmId) return "I need a specific flock to check — this question isn't set up for a network-wide view yet.";
  const flocks = await getAllFlocks(farmId);
  const active = flocks.filter((f) => f.status === "active");
  if (active.length === 0) return "There's no active flock to check.";

  for (const flock of active) {
    const records = await getRecentDailyRecords(flock.id, 21);
    const trend = predictProductionTrend(records);
    if (trend.status === "ok" && trend.value.direction === "down") {
      return `${flock.batch_code}: ${trend.explanation}`;
    }
  }
  return "Egg production hasn't shown a decline in your active flock(s) recently.";
}

async function answerFeedNextWeek({ tenantId }: AssistantContext): Promise<string> {
  const supabase = await createClient();
  const range = lastNDaysRange(14);
  const { data: items } = await supabase
    .from("poultryedos_inventory_items")
    .select("id, name, unit, stock_on_hand")
    .eq("tenant_id", tenantId)
    .eq("category", "feed")
    .eq("is_active", true);

  if (!items || items.length === 0) {
    return "You don't have any feed items tracked in Inventory yet, so I can't estimate next week's need from usage history.";
  }

  const lines: string[] = [];
  for (const item of items) {
    const { data: outTx } = await supabase
      .from("poultryedos_inventory_transactions")
      .select("quantity, transaction_date")
      .eq("item_id", item.id)
      .eq("transaction_type", "out")
      .gte("transaction_date", range.from);
    const prediction = predictFeedStockout(item, outTx ?? []);
    if (prediction.status === "ok") {
      const weeklyNeed = prediction.value.dailyRateKg * 7;
      lines.push(`${item.name}: about ${weeklyNeed.toFixed(0)} ${item.unit} (${prediction.value.daysRemaining} day(s) of current stock left)`);
    }
  }

  return lines.length > 0
    ? `Based on recent usage: ${lines.join("; ")}.`
    : "Not enough logged feed usage yet to estimate next week's need — log usage under Inventory as you go.";
}

async function answerBiggestExpenses({ tenantId, currency }: AssistantContext): Promise<string> {
  const report = await getFinancialReport(tenantId, lastNDaysRange(30));
  if (report.expensesByCategory.length === 0) return "No expenses logged in the last 30 days.";
  const top = report.expensesByCategory.slice(0, 3);
  return `Over the last 30 days, your biggest expense categories were: ${top
    .map((c) => `${c.category} (${formatMoney(c.amountCents, currency)})`)
    .join(", ")}.`;
}

async function answerWhichBatchToSell({ farmId, currency }: AssistantContext): Promise<string> {
  if (!farmId) return "I need a specific farm to check — this question isn't set up for a network-wide view yet.";
  const flocks = await getAllFlocks(farmId);
  const active = flocks.filter((f) => f.status === "active");
  if (active.length === 0) return "There's no active flock to consider selling.";

  const withFinance = await Promise.all(active.map(async (f) => ({ flock: f, finance: await getFlockFinance(f.id) })));
  const best = withFinance.reduce((a, b) => (b.finance.profitCents > a.finance.profitCents ? b : a));
  const ageDays = Math.floor((Date.now() - new Date(best.flock.placement_date).getTime()) / (1000 * 60 * 60 * 24));
  return (
    `${best.flock.batch_code} looks strongest financially right now (estimated profit ${formatMoney(best.finance.profitCents, currency)}, ` +
    `${ageDays} days old). This isn't a market-readiness assessment — it doesn't account for bird weight, which this app doesn't track yet — ` +
    `just which batch has performed best financially so far.`
  );
}

async function answerHighestMortalityFarm({ tenantId }: AssistantContext): Promise<string> {
  const range = lastNDaysRange(30);
  const supabase = await createClient();
  const { data: farms } = await supabase.from("poultryedos_farms").select("id, name").eq("tenant_id", tenantId);
  if (!farms || farms.length <= 1) return "There's only one farm in this network, so there's nothing to compare.";

  const mortality = await getMortalityReport(tenantId, range);
  const { data: flocks } = await supabase.from("poultryedos_flocks").select("id, farm_id").eq("tenant_id", tenantId);
  const farmMortality = new Map<string, number>();
  for (const row of mortality.rows) {
    const flock = flocks?.find((f) => f.id === row.flockId);
    if (!flock) continue;
    farmMortality.set(flock.farm_id, (farmMortality.get(flock.farm_id) ?? 0) + row.mortality);
  }
  if (farmMortality.size === 0) return "No mortality recorded across the network in the last 30 days.";

  const [worstFarmId, worstCount] = [...farmMortality.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
  const farmName = farms.find((f) => f.id === worstFarmId)?.name ?? "Unknown farm";
  return `${farmName} has had the highest mortality in the last 30 days, with ${worstCount} death(s) recorded.`;
}

// --- Optional free-text mode, gated behind a real API key -----------------

export function isAssistantLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Sends only already-computed facts (never raw row access) to Claude for
 * natural-language phrasing — the same "clean interface, documented
 * integration point" pattern as src/lib/payments/mpesa.ts. Returns a typed
 * not-configured result when no API key is set, exactly like
 * isMpesaConfigured()/initiateStkPush(). */
export async function answerFreeform(
  question: string,
  dataSummary: string,
): Promise<{ ok: true; answer: string } | { ok: false; reason: "not_configured" | "request_failed"; message?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "not_configured" };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system:
          "You are a farm assistant. Answer ONLY using the data provided below — never invent numbers, never diagnose disease, never prescribe medication. If the data provided doesn't answer the question, say so plainly.",
        messages: [{ role: "user", content: `Farm data:\n${dataSummary}\n\nQuestion: ${question}` }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: "request_failed", message: text || `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { content?: { text?: string }[] };
    const answer = data.content?.[0]?.text?.trim();
    if (!answer) return { ok: false, reason: "request_failed", message: "Empty response" };
    return { ok: true, answer };
  } catch (err) {
    return { ok: false, reason: "request_failed", message: err instanceof Error ? err.message : "unknown_error" };
  }
}
