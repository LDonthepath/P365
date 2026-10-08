import { MACRO_SERIES_REGISTRY, type MacroSeriesId } from "../data/macro-registry";

/** FRED provider metadata window; publisher release dates are not used here. */
// The proposed */5 cron hits 04:30 UTC. Keep the recovery sweep on that
// single invocation instead of repeating a full sweep on every poll in hour 4.
const DAILY_FULL_SWEEP_UTC_HOUR = 4;
const DAILY_FULL_SWEEP_UTC_MINUTE = 30;
const PROVIDER_UPDATE_LOOKBACK_MS = 15 * 60_000;
const FRED_UPDATES_LIMIT = 1000;
const FRED_UPDATES_MAX_PAGES = 20;
const FRED_UPDATES_URL = "https://api.stlouisfed.org/fred/series/updates";

type FredSeriesUpdate = { id?: unknown; last_updated?: unknown };
type FredUpdatesPayload = { count?: unknown; offset?: unknown; limit?: unknown; seriess?: unknown };

export type FredProviderUpdatePlan = {
  seriesIds: MacroSeriesId[];
  mode: "PROVIDER_UPDATE_RECHECK" | "NO_REGISTERED_UPDATES" | "DAILY_FULL_SWEEP" | "FAIL_OPEN_FULL_SWEEP";
  scanAsOfUTC: string;
  scanWindowStartUTC: string;
  requestedSeriesCount: number;
  matchedRegisteredUpdates: number;
};

function fullPlan(now: Date, mode: FredProviderUpdatePlan["mode"]): FredProviderUpdatePlan {
  const ids = MACRO_SERIES_REGISTRY.map((series) => series.seriesId);
  return {
    seriesIds: ids,
    mode,
    scanAsOfUTC: now.toISOString(),
    scanWindowStartUTC: new Date(now.getTime() - PROVIDER_UPDATE_LOOKBACK_MS).toISOString(),
    requestedSeriesCount: ids.length,
    matchedRegisteredUpdates: 0,
  };
}

/** FRED last_updated carries an explicit offset, e.g. `2026-10-08 07:29:00-05`. */
function parseFredTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(value);
  if (!match) return null;
  const offset = match[3] === "Z" ? "Z" : match[3].length === 3 ? `${match[3]}:00`
    : match[3].includes(":") ? match[3] : `${match[3].slice(0, 3)}:${match[3].slice(3)}`;
  const parsed = Date.parse(`${match[1]}T${match[2]}${offset}`);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * Select only registered P365 series that FRED reports as updated within the
 * overlap window. The endpoint is paged until the window boundary is covered;
 * any malformed/partial scan fails open rather than silently skipping data.
 */
export async function planFredProviderUpdatedObservations(
  options: { now?: Date; apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<FredProviderUpdatePlan> {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid scheduler date");
  if (now.getUTCHours() === DAILY_FULL_SWEEP_UTC_HOUR
    && now.getUTCMinutes() === DAILY_FULL_SWEEP_UTC_MINUTE) {
    return fullPlan(now, "DAILY_FULL_SWEEP");
  }

  const apiKey = options.apiKey ?? process.env.FRED_API_KEY;
  if (!apiKey) return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
  const fetcher = options.fetcher ?? fetch;
  const eligible = new Set<string>(MACRO_SERIES_REGISTRY.map((series) => series.seriesId));
  const windowStart = now.getTime() - PROVIDER_UPDATE_LOOKBACK_MS;
  const selected = new Set<MacroSeriesId>();
  let offset = 0;
  let expectedTotal: number | null = null;
  let previousUpdatedAt = Number.POSITIVE_INFINITY;
  let coveredWindow = false;

  try {
    for (let page = 0; page < FRED_UPDATES_MAX_PAGES; page++) {
      const url = new URL(FRED_UPDATES_URL);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("file_type", "json");
      url.searchParams.set("filter_value", "macro");
      url.searchParams.set("order_by", "last_updated");
      url.searchParams.set("sort_order", "desc");
      url.searchParams.set("limit", String(FRED_UPDATES_LIMIT));
      url.searchParams.set("offset", String(offset));
      const response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(3_500) });
      if (!response.ok) return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
      const raw: unknown = await response.json();
      if (!isRecord(raw)) return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
      const payload = raw as FredUpdatesPayload;
      const total = payload.count;
      if (!Number.isSafeInteger(total) || (total as number) < 0
        || (expectedTotal !== null && total !== expectedTotal)
        || payload.offset !== offset || payload.limit !== FRED_UPDATES_LIMIT
        || !Array.isArray(payload.seriess)
        || payload.seriess.length !== Math.min(FRED_UPDATES_LIMIT, (total as number) - offset)) {
        return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
      }
      if (expectedTotal === null) expectedTotal = total as number;
      const rows = payload.seriess as FredSeriesUpdate[];
      if (rows.length === 0) {
        coveredWindow = true;
        break;
      }

      let reachedBeforeWindow = false;
      for (const row of rows) {
        if (!isRecord(row)) return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
        const updatedAt = parseFredTimestamp(row.last_updated);
        if (!updatedAt || typeof row.id !== "string" || updatedAt > now.getTime()
          || updatedAt > previousUpdatedAt) return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
        previousUpdatedAt = updatedAt;
        if (updatedAt < windowStart) reachedBeforeWindow = true;
        if (updatedAt >= windowStart && eligible.has(row.id)) selected.add(row.id as MacroSeriesId);
      }

      offset += rows.length;
      if (reachedBeforeWindow || offset >= expectedTotal) {
        coveredWindow = true;
        break;
      }
      if (rows.length !== FRED_UPDATES_LIMIT) return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
    }

    if (!coveredWindow) return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
    const seriesIds = MACRO_SERIES_REGISTRY
      .map((series) => series.seriesId)
      .filter((seriesId) => selected.has(seriesId));
    return {
      seriesIds,
      mode: seriesIds.length > 0 ? "PROVIDER_UPDATE_RECHECK" : "NO_REGISTERED_UPDATES",
      scanAsOfUTC: now.toISOString(),
      scanWindowStartUTC: new Date(windowStart).toISOString(),
      requestedSeriesCount: seriesIds.length,
      matchedRegisteredUpdates: seriesIds.length,
    };
  } catch {
    // The URL carries the API key; do not echo upstream exceptions.
    return fullPlan(now, "FAIL_OPEN_FULL_SWEEP");
  }
}
