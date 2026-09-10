import type { DailyRecord } from "@/lib/database.types";

export interface FeedEfficiency {
  totalFeedKg: number;
  totalEggs: number;
  daysWithFeedRecorded: number;
  gramsPerBirdPerDay: number | null;
  feedPerDozenEggsKg: number | null;
}

/**
 * Feed-per-bird-per-day (in grams) and feed conversion ratio expressed as
 * kg of feed per dozen eggs — the two derived metrics the audit against
 * real farmer requirements flagged as missing. Both are computed from
 * existing daily records; no new data collection is needed for these.
 *
 * `currentQuantity` is used as the bird-count denominator. It's an
 * approximation (the true average over the period would need weight to
 * the day mortality happened), but bird count moves slowly compared to
 * daily feed use, so it's a reasonable stand-in without adding a
 * historical bird-count ledger.
 */
export function computeFeedEfficiency(
  records: DailyRecord[],
  currentQuantity: number,
): FeedEfficiency {
  const withFeed = records.filter((r) => r.feed_consumed_kg != null);
  const totalFeedKg = withFeed.reduce((sum, r) => sum + (r.feed_consumed_kg ?? 0), 0);
  const totalEggs = records.reduce((sum, r) => sum + (r.eggs_collected ?? 0), 0);
  const daysWithFeedRecorded = withFeed.length;

  const gramsPerBirdPerDay =
    daysWithFeedRecorded > 0 && currentQuantity > 0
      ? (totalFeedKg * 1000) / currentQuantity / daysWithFeedRecorded
      : null;

  const feedPerDozenEggsKg = totalEggs > 0 ? totalFeedKg / (totalEggs / 12) : null;

  return { totalFeedKg, totalEggs, daysWithFeedRecorded, gramsPerBirdPerDay, feedPerDozenEggsKg };
}
