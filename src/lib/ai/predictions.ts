import type { DailyRecord, InventoryItem, InventoryTransaction } from "@/lib/database.types";

// EDOS Poultry360 AI/ML engine (spec §49-55) — Levels 1-3 only (rule-based,
// historical-trend comparison, simple statistical forecasting). There is
// no cross-tenant historical dataset and no training pipeline, so real
// Level 4/5 machine learning is not attempted here — spec §51 explicitly
// prefers "not enough data yet" over fabricated intelligence, which is
// exactly what PredictionResult's "insufficient_data" status is for.
//
// Every function is pure (no side effects, no I/O) and returns the exact
// fields spec §52 asks every prediction to carry: the value, a confidence,
// what data was used, and a plain-language explanation — never a bare
// score (spec §96).

export interface PredictionOk<T> {
  status: "ok";
  value: T;
  confidence: number; // 0-100
  dataUsed: string;
  explanation: string;
  generatedAt: string;
}

export interface PredictionInsufficientData {
  status: "insufficient_data";
  explanation: string;
  generatedAt: string;
}

export type PredictionResult<T> = PredictionOk<T> | PredictionInsufficientData;

function now(): string {
  return new Date().toISOString();
}

function insufficient(explanation: string): PredictionInsufficientData {
  return { status: "insufficient_data", explanation, generatedAt: now() };
}

// --- Feed / stock-out ------------------------------------------------------

const MIN_OUT_TRANSACTIONS = 3;

export interface FeedStockoutPrediction {
  daysRemaining: number;
  dailyRateKg: number;
}

/** Level 3: simple linear depletion — recent average daily consumption
 * (from "out" transactions on this item) projected against current stock.
 * Deliberately not fitted to a curve or seasonally adjusted — that would
 * imply a confidence this app can't back up with real historical volume. */
export function predictFeedStockout(
  item: Pick<InventoryItem, "stock_on_hand" | "name" | "unit">,
  recentOutTransactions: Pick<InventoryTransaction, "quantity" | "transaction_date">[],
  windowDays = 14,
): PredictionResult<FeedStockoutPrediction> {
  if (recentOutTransactions.length < MIN_OUT_TRANSACTIONS) {
    return insufficient(
      `Not enough usage history for ${item.name} yet — log a few more "used" entries to get a stock-out estimate.`,
    );
  }

  const totalUsed = recentOutTransactions.reduce((sum, t) => sum + t.quantity, 0);
  const dailyRateKg = totalUsed / windowDays;

  if (dailyRateKg <= 0) {
    return insufficient(`${item.name} usage has been zero recently — no depletion rate to project from.`);
  }

  const daysRemaining = Math.round(item.stock_on_hand / dailyRateKg);
  const confidence = Math.min(85, 40 + recentOutTransactions.length * 5);

  return {
    status: "ok",
    value: { daysRemaining, dailyRateKg },
    confidence,
    dataUsed: `${recentOutTransactions.length} usage entries over the last ${windowDays} days`,
    explanation:
      daysRemaining <= 7
        ? `At the recent usage rate of ${dailyRateKg.toFixed(1)} ${item.unit}/day, ${item.name} may run out in about ${daysRemaining} day(s).`
        : `At the recent usage rate of ${dailyRateKg.toFixed(1)} ${item.unit}/day, ${item.name} should last about ${daysRemaining} more day(s).`,
    generatedAt: now(),
  };
}

// --- Egg production trend ---------------------------------------------------

const MIN_RECORDS_FOR_TREND = 14;

export interface ProductionTrendPrediction {
  recentAvgEggs: number;
  priorAvgEggs: number;
  changePct: number;
  direction: "up" | "down" | "flat";
  next7DayProjection: number;
}

/** Level 2 (trend comparison) + a naive Level 3 projection. `records` must
 * be ordered most-recent-first (the convention every caller in this app
 * already uses — see getRecentDailyRecords). */
export function predictProductionTrend(records: DailyRecord[]): PredictionResult<ProductionTrendPrediction> {
  const withEggs = records.filter((r) => r.eggs_collected != null);
  if (withEggs.length < MIN_RECORDS_FOR_TREND) {
    return insufficient("Not enough days of egg records yet for a reliable production trend — keep recording daily.");
  }

  const recent = withEggs.slice(0, 7);
  const prior = withEggs.slice(7, 14);
  if (prior.length < 5) {
    return insufficient("Not enough prior-week data yet to compare against — keep recording daily.");
  }

  const avg = (rs: DailyRecord[]) => rs.reduce((sum, r) => sum + (r.eggs_collected ?? 0), 0) / rs.length;
  const recentAvg = avg(recent);
  const priorAvg = avg(prior);
  const changePct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;
  const direction = changePct > 5 ? "up" : changePct < -5 ? "down" : "flat";

  const explanation =
    direction === "down"
      ? `Egg collection has averaged ${recentAvg.toFixed(0)}/day over the last week, down ${Math.abs(changePct).toFixed(0)}% from ${priorAvg.toFixed(0)}/day the week before. Worth checking feed, water, heat stress, and house conditions.`
      : direction === "up"
        ? `Egg collection has averaged ${recentAvg.toFixed(0)}/day over the last week, up ${changePct.toFixed(0)}% from ${priorAvg.toFixed(0)}/day the week before.`
        : `Egg collection has held steady at around ${recentAvg.toFixed(0)}/day over the last two weeks.`;

  return {
    status: "ok",
    value: {
      recentAvgEggs: recentAvg,
      priorAvgEggs: priorAvg,
      changePct,
      direction,
      next7DayProjection: Math.round(recentAvg * 7),
    },
    confidence: Math.min(80, 50 + withEggs.length),
    dataUsed: `${withEggs.length} days of egg records`,
    explanation,
    generatedAt: now(),
  };
}

// --- Financial trend ---------------------------------------------------------

export interface FinancialTrendPrediction {
  profitChangeCents: number;
  changePct: number;
  direction: "up" | "down" | "flat";
}

/** Level 2: compares two already-computed FinancialReport periods (see
 * src/lib/data/reports.ts) — no new aggregation logic, just a comparison. */
export function predictFinancialTrend(
  current: { profitCents: number },
  prior: { profitCents: number },
): PredictionResult<FinancialTrendPrediction> {
  if (current.profitCents === 0 && prior.profitCents === 0) {
    return insufficient("Not enough sales or expense records yet for a financial trend.");
  }

  const profitChangeCents = current.profitCents - prior.profitCents;
  const changePct = prior.profitCents !== 0 ? (profitChangeCents / Math.abs(prior.profitCents)) * 100 : 0;
  const direction = changePct > 5 ? "up" : changePct < -5 ? "down" : "flat";

  return {
    status: "ok",
    value: { profitChangeCents, changePct, direction },
    confidence: 65,
    dataUsed: "current vs. prior period sales and expenses",
    explanation:
      direction === "up"
        ? "Profit is trending up compared to the previous period."
        : direction === "down"
          ? "Profit is trending down compared to the previous period — worth reviewing recent expenses."
          : "Profit has held roughly steady compared to the previous period.",
    generatedAt: now(),
  };
}
