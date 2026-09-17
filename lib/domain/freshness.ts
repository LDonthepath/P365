import type { DataQuality } from "./types";

export type FreshnessFamily =
  | "FRED_MACRO"
  | "MARKET_REALTIME"
  | "MARKET_DAILY"
  | "NEWS"
  | "ECONOMIC_CALENDAR"
  | "POLICY_CALENDAR";

export type FreshnessPolicy = {
  family: FreshnessFamily;
  maxAgeMs: number;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const FRESHNESS_POLICIES: Record<FreshnessFamily, FreshnessPolicy> = {
  FRED_MACRO: { family: "FRED_MACRO", maxAgeMs: 5 * DAY },
  MARKET_REALTIME: { family: "MARKET_REALTIME", maxAgeMs: 15 * MINUTE },
  MARKET_DAILY: { family: "MARKET_DAILY", maxAgeMs: 5 * DAY },
  NEWS: { family: "NEWS", maxAgeMs: 24 * HOUR },
  ECONOMIC_CALENDAR: { family: "ECONOMIC_CALENDAR", maxAgeMs: 24 * HOUR },
  POLICY_CALENDAR: { family: "POLICY_CALENDAR", maxAgeMs: 7 * DAY },
};

export function qualityFromFreshness(referenceAt: string, policy: FreshnessPolicy, nowMs = Date.now()): DataQuality {
  const referenceMs = new Date(referenceAt).getTime();
  if (!Number.isFinite(referenceMs) || referenceMs > nowMs) return "UNKNOWN";
  return nowMs - referenceMs <= policy.maxAgeMs ? "FRESH" : "STALE";
}

export function freshnessPolicyForFamily(family: FreshnessFamily): FreshnessPolicy {
  return FRESHNESS_POLICIES[family];
}
