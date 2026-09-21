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

export type MacroCadenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";

export type MacroFreshnessInput = {
  observationDate: string;
  frequency: MacroCadenceFrequency;
  toleranceMs: number;
  evaluatedAt: string;
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

function dateOnlyStartMs(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) return null;
  return parsed;
}

function macroCadenceReferenceMs(observationStartMs: number, frequency: MacroCadenceFrequency): number {
  const observed = new Date(observationStartMs);
  if (frequency === "MONTHLY") {
    return Date.UTC(observed.getUTCFullYear(), observed.getUTCMonth() + 1, 1) - 1;
  }
  if (frequency === "QUARTERLY") {
    const nextQuarterMonth = Math.floor(observed.getUTCMonth() / 3) * 3 + 3;
    return Date.UTC(observed.getUTCFullYear(), nextQuarterMonth, 1) - 1;
  }

  // FRED daily and weekly date conventions are not uniformly qualified as
  // period starts, so FND-011A preserves their existing date-anchor behavior.
  return observationStartMs;
}

/**
 * Assesses registry-backed FRED freshness at the time P365 acquired the fact.
 * Monthly and quarterly dates are period anchors, so tolerance begins at the
 * end of that period. This is a cadence policy, not a fabricated release time.
 */
export function qualityFromMacroCadence(input: MacroFreshnessInput): DataQuality {
  const observationStartMs = dateOnlyStartMs(input.observationDate);
  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  if (
    observationStartMs === null
    || !Number.isFinite(evaluatedAtMs)
    || !Number.isFinite(input.toleranceMs)
    || input.toleranceMs < 0
    || observationStartMs > evaluatedAtMs
  ) {
    return "UNKNOWN";
  }

  const referenceMs = macroCadenceReferenceMs(observationStartMs, input.frequency);
  const deadlineMs = referenceMs + input.toleranceMs;
  if (!Number.isFinite(deadlineMs)) return "UNKNOWN";
  return evaluatedAtMs <= deadlineMs ? "FRESH" : "STALE";
}

export function freshnessPolicyForFamily(family: FreshnessFamily): FreshnessPolicy {
  return FRESHNESS_POLICIES[family];
}
