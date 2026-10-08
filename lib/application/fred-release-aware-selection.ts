import { MACRO_SERIES_REGISTRY, type MacroSeriesId } from "../data/macro-registry";

/**
 * FRS-003: opt-in FRED observation request planner.
 * Hourly DAILY+WEEKLY (21) retain their exact existing availability check.
 * Only MONTHLY+QUARTERLY (12) can be deferred outside a source-release day.
 * Source publisher dates do NOT prove when FRED observations become available.
 */
const FRED_RELEASE_BY_SLOW_SERIES = {
  FEDFUNDS: 18,
  M2SL: 21,
  CPIAUCSL: 10,
  CPILFESL: 10,
  PCEPI: 54,
  PCEPILFE: 54,
  UNRATE: 50,
  PAYEMS: 50,
  JTSJOL: 192,
  JTSQUR: 192,
  SAHMREALTIME: 456,
  GDPC1: 53,
} as const satisfies Partial<Record<MacroSeriesId, number>>;

/** Business policy candidate, requires explicit owner approval before cron activation. */
const FULL_SWEEP_UTC_HOUR = 4;
const RELEASE_LOOKBACK_CALENDAR_DAYS = 2;
const FRED_CALENDAR_LIMIT = 1000;
const FRED_CALENDAR_MAX_PAGES = 4;

export type FredSchedulerPlan = {
  seriesIds: MacroSeriesId[];
  mode: "HOURLY_FREQUENT" | "RELEASE_RECHECK" | "DAILY_FULL_SWEEP" | "FAIL_OPEN_FULL_SWEEP";
  calendarDateNY: string;
  requestedSeriesCount: number;
  releaseWindowSeriesCount: number;
};

function dateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === value;
}
function nyDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (field: "year" | "month" | "day") => parts.find((p) => p.type === field)?.value;
  return [get("year"), get("month"), get("day")].join("-");
}
function dateDaysBefore(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00.000Z") - days * 86_400_000).toISOString().slice(0, 10);
}
function fullPlan(nowNY: string, mode: FredSchedulerPlan["mode"]): FredSchedulerPlan {
  const ids = MACRO_SERIES_REGISTRY.map((s) => s.seriesId);
  return { seriesIds: ids, mode, calendarDateNY: nowNY,
    requestedSeriesCount: ids.length, releaseWindowSeriesCount: 0 };
}

/** Exact registry is checked at runtime, never silently omit a new series. */
function slowIds(): MacroSeriesId[] | null {
  const slow = MACRO_SERIES_REGISTRY
    .filter((s) => s.frequency === "MONTHLY" || s.frequency === "QUARTERLY")
    .map((s) => s.seriesId);
  const configured = Object.keys(FRED_RELEASE_BY_SLOW_SERIES);
  if (slow.length !== configured.length || slow.some((id) => !Object.hasOwn(FRED_RELEASE_BY_SLOW_SERIES, id))) {
    return null;
  }
  return slow;
}

/**
 * Fail OPEN to all 33 when no key, API error, invalid/partial source calendar,
 * registry drift, or any unexpected response. The caller must already be
 * authenticated; no credential or FRED upstream URL appears in the plan.
 */
export async function planFredReleaseAwareObservations(
  options: {
    now?: Date;
    apiKey?: string;
    fetcher?: typeof fetch;
  } = {},
): Promise<FredSchedulerPlan> {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid scheduler date");
  const calendarDateNY = nyDate(now);
  const slow = slowIds();
  if (!slow) return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
  // Operational safety sweep, NOT an inferred publisher release hour.
  if (now.getUTCHours() === FULL_SWEEP_UTC_HOUR) {
    return fullPlan(calendarDateNY, "DAILY_FULL_SWEEP");
  }
  const apiKey = options.apiKey ?? process.env.FRED_API_KEY;
  if (!apiKey) return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
  const start = dateDaysBefore(calendarDateNY, RELEASE_LOOKBACK_CALENDAR_DAYS);
  // FRED 'realtime_start/end' are VINTAGE filters, not filters on
  // publisher release dates. A single 1000-result page is NOT exhaustive.
  // Fetch strictly descending release_date pages until we pass the
  // earliest eligible NY date, or fail open after a bounded page cap.
  const published = new Set<number>();
  let finished = false;
  let lastDate: string | null = null;
  try {
    for (let page = 0; page < FRED_CALENDAR_MAX_PAGES; page++) {
      const offset = page * FRED_CALENDAR_LIMIT;
      const url = new URL("https://api.stlouisfed.org/fred/releases/dates");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("file_type", "json");
      url.searchParams.set("include_release_dates_with_no_data", "true");
      url.searchParams.set("order_by", "release_date");
      url.searchParams.set("sort_order", "desc");
      url.searchParams.set("limit", String(FRED_CALENDAR_LIMIT));
      url.searchParams.set("offset", String(offset));

      const response = await (options.fetcher ?? fetch)(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(3_500),
      });
      if (!response.ok) return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
      const raw: unknown = await response.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
      }
      const j = raw as Record<string, unknown>;
      if (!Array.isArray(j.release_dates) || !Number.isSafeInteger(j.count)
        || (j.count as number) < 0
        || (j.offset !== undefined && j.offset !== offset)
        || (j.limit !== undefined && j.limit !== FRED_CALENDAR_LIMIT)) {
        return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
      }
      const count = j.count as number;
      const expected = Math.max(0, Math.min(FRED_CALENDAR_LIMIT, count - offset));
      const entries = j.release_dates as unknown[];
      if (entries.length !== expected) {
        return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
      }
      for (const value of entries) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
        }
        const row = value as Record<string, unknown>;
        if (!dateOnly(row.date) || !Number.isSafeInteger(row.release_id)
          || (row.release_id as number) <= 0
          || (lastDate !== null && (row.date as string) > lastDate)) {
          return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
        }
        lastDate = row.date as string;
        if (lastDate < start) {
          finished = true;
          break;
        }
        if (lastDate <= calendarDateNY) published.add(row.release_id as number);
      }
      if (finished || offset + entries.length >= count) {
        finished = true;
        break;
      }
    }
    // If the source has >4 pages of future/current releases, do not
    // pretend the queried period was exhaustive: keep old 33-series path.
    if (!finished) return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
    const matchingSlow = slow.filter((id) =>
      published.has(FRED_RELEASE_BY_SLOW_SERIES[id as keyof typeof FRED_RELEASE_BY_SLOW_SERIES]));
    const eligible = new Set(matchingSlow);
    const ids = MACRO_SERIES_REGISTRY
      .filter((s) => s.frequency === "DAILY" || s.frequency === "WEEKLY"
        || eligible.has(s.seriesId))
      .map((s) => s.seriesId);
    if (ids.length + slow.length - matchingSlow.length !== MACRO_SERIES_REGISTRY.length) {
      return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
    }
    return {
      seriesIds: ids,
      mode: matchingSlow.length > 0 ? "RELEASE_RECHECK" : "HOURLY_FREQUENT",
      calendarDateNY,
      requestedSeriesCount: ids.length,
      releaseWindowSeriesCount: matchingSlow.length,
    };
  } catch {
    // Do not log untrusted upstream exception: the URL contains the API key.
    return fullPlan(calendarDateNY, "FAIL_OPEN_FULL_SWEEP");
  }
}
