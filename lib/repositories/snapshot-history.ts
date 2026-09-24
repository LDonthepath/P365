import type { MarketSnapshot } from "../domain/market-snapshot";
import type { MarketSnapshotHistoryQuery } from "./types";

export const MAX_MARKET_SNAPSHOT_HISTORY_LIMIT = 500;

export function marketSnapshotHistoryTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid " + field + " timestamp: " + value);
  }
  return parsed;
}

export function validateMarketSnapshotHistoryQuery(
  query: MarketSnapshotHistoryQuery,
): { from?: number; through?: number } {
  if (!query?.scope?.trim()) {
    throw new Error("Market Snapshot history requires a non-empty scope.");
  }
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_MARKET_SNAPSHOT_HISTORY_LIMIT) {
    throw new Error(
      "Market Snapshot history limit must be an integer between 1 and "
      + MAX_MARKET_SNAPSHOT_HISTORY_LIMIT
      + ".",
    );
  }
  if (query.order !== "ASC" && query.order !== "DESC") {
    throw new Error("Market Snapshot history order must be ASC or DESC.");
  }

  const from = query.capturedAtOnOrAfter === undefined
    ? undefined
    : marketSnapshotHistoryTimestamp(query.capturedAtOnOrAfter, "capturedAtOnOrAfter");
  const through = query.capturedAtOnOrBefore === undefined
    ? undefined
    : marketSnapshotHistoryTimestamp(query.capturedAtOnOrBefore, "capturedAtOnOrBefore");
  if (from !== undefined && through !== undefined && from > through) {
    throw new Error("Market Snapshot history lower bound must not be after its upper bound.");
  }
  return { from, through };
}

export function compareMarketSnapshotHistory(
  a: MarketSnapshot,
  b: MarketSnapshot,
): number {
  const captured = marketSnapshotHistoryTimestamp(a.capturedAt, "MarketSnapshot.capturedAt")
    - marketSnapshotHistoryTimestamp(b.capturedAt, "MarketSnapshot.capturedAt");
  if (captured !== 0) return captured;
  return a.id.localeCompare(b.id);
}
