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

export type MarketFreshnessCalendar =
  | "CONTINUOUS_24_7"
  | "CME_GLOBEX_GOLD"
  | "ICE_USDX"
  | "RUSSELL_2000_CASH_INDEX";

export type MarketFreshnessInput = {
  observedAt: string;
  evaluatedAt: string;
  maxAgeMs: number;
  calendar: MarketFreshnessCalendar;
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

const NEW_YORK_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type NewYorkWeekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

function newYorkClock(timestampMs: number): { weekday: NewYorkWeekday; secondOfDay: number } | null {
  const parts = NEW_YORK_CLOCK.formatToParts(new Date(timestampMs));
  const weekday = parts.find((part) => part.type === "weekday")?.value as NewYorkWeekday | undefined;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const second = Number(parts.find((part) => part.type === "second")?.value);
  if (
    !weekday
    || !["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].includes(weekday)
    || !Number.isInteger(hour)
    || !Number.isInteger(minute)
    || !Number.isInteger(second)
  ) {
    return null;
  }
  return { weekday, secondOfDay: hour * 3600 + minute * 60 + second };
}

function marketFreshnessWindowOpenAt(timestampMs: number, calendar: MarketFreshnessCalendar): boolean {
  if (calendar === "CONTINUOUS_24_7") return true;

  const clock = newYorkClock(timestampMs);
  if (!clock) return false;

  const { weekday, secondOfDay } = clock;
  const atOrAfter = (hour: number, minute = 0): boolean => secondOfDay >= hour * 3600 + minute * 60;
  const before = (hour: number, minute = 0): boolean => secondOfDay < hour * 3600 + minute * 60;

  if (calendar === "CME_GLOBEX_GOLD") {
    // COMEX Gold: Sunday 18:00 ET through Friday 17:00 ET, with the
    // regular daily maintenance break from 17:00-18:00 ET Mon-Thu.
    if (weekday === "Sat") return false;
    if (weekday === "Sun") return atOrAfter(18);
    if (weekday === "Fri") return before(17);
    return before(17) || atOrAfter(18);
  }

  if (calendar === "ICE_USDX") {
    // ICE USDX: Sunday special open at 18:00 ET; Mon-Thu electronic
    // session runs 20:00-17:00 ET across the trade date; Friday closes 17:00.
    if (weekday === "Sat") return false;
    if (weekday === "Sun") return atOrAfter(18);
    if (weekday === "Fri") return before(17);
    return before(17) || atOrAfter(20);
  }

  // Yahoo ^RUT is the cash Russell 2000 index, not the nearly-24h RUT
  // options product. US constituent exchanges publish official closes at
  // 16:00 ET, while production Yahoo ^RUT observations can carry a final
  // provider timestamp around 16:30 ET. P365 therefore qualifies a bounded
  // 09:30-16:31 ET provider freshness window. This is not represented as an
  // official LSEG market-close or index-publication schedule.
  if (weekday === "Sat" || weekday === "Sun") return false;
  return atOrAfter(9, 30) && before(16, 31);
}

function marketFreshnessElapsedMs(
  observedAtMs: number,
  evaluatedAtMs: number,
  calendar: MarketFreshnessCalendar,
  stopAfterMs: number,
): number {
  if (calendar === "CONTINUOUS_24_7") return evaluatedAtMs - observedAtMs;

  let cursor = observedAtMs;
  let windowElapsedMs = 0;

  // Freshness thresholds are short (15 minutes today). Walk to absolute
  // minute boundaries and accumulate only qualified freshness-window time.
  // Aligning chunks to minute boundaries prevents a chunk from straddling a
  // session/open-close boundary and over/under-counting sub-minute time.
  while (cursor < evaluatedAtMs && windowElapsedMs <= stopAfterMs) {
    const nextMinuteBoundary = (Math.floor(cursor / MINUTE) + 1) * MINUTE;
    const next = Math.min(nextMinuteBoundary, evaluatedAtMs);
    const midpoint = cursor + (next - cursor) / 2;
    if (marketFreshnessWindowOpenAt(midpoint, calendar)) {
      windowElapsedMs += next - cursor;
    }
    cursor = next;
  }

  return windowElapsedMs;
}

/**
 * Assesses realtime market freshness at the acquisition time. Continuous
 * crypto ages in wall-clock time. Sessioned Yahoo instruments age only while
 * their qualified regular electronic/cash market is scheduled open.
 *
 * This models regular weekly sessions, not exchange holiday/early-close
 * exceptions. It never fabricates a provider quote timestamp or market state.
 */
export function qualityFromMarketHours(input: MarketFreshnessInput): DataQuality {
  const observedAtMs = Date.parse(input.observedAt);
  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  if (
    !Number.isFinite(observedAtMs)
    || !Number.isFinite(evaluatedAtMs)
    || !Number.isFinite(input.maxAgeMs)
    || input.maxAgeMs < 0
    || observedAtMs > evaluatedAtMs
  ) {
    return "UNKNOWN";
  }

  if (
    input.calendar !== "CONTINUOUS_24_7"
    && !marketFreshnessWindowOpenAt(observedAtMs, input.calendar)
  ) {
    return "UNKNOWN";
  }

  return marketFreshnessElapsedMs(observedAtMs, evaluatedAtMs, input.calendar, input.maxAgeMs) <= input.maxAgeMs
    ? "FRESH"
    : "STALE";
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
