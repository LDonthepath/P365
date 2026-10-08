import "server-only";
import { MACRO_SERIES_REGISTRY } from "./macro-registry";
import type { ProviderResult } from "./types";
import { providerResult } from "./types";
import {
  fetchFredSeriesObservations,
  type FredObservationQuery,
  type MacroObservationInput,
} from "./fred-observation-pages";

export type { FredObservationQuery, MacroObservationInput } from "./fred-observation-pages";

/**
 * Source-native temporal fields are explicit. FRED's standard observations
 * response does not provide a per-observation publication/release timestamp,
 * so releasedAt remains null rather than being inferred from observationDate,
 * realtime_start, or P365 retrieval time.
 */
function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function fetchFredMacroObservations(query: FredObservationQuery = {}): Promise<ProviderResult<MacroObservationInput>> {
  // Provider-update scheduler may intentionally select no series when FRED's
  // provider update feed reports no registered series updated in its overlap.
  // Request parsing prevents user-supplied empty `fredSeries` selectors.
  if (Array.isArray(query.seriesIds) && query.seriesIds.length === 0) {
    return providerResult("fred", "EMPTY", []);
  }
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)) return providerResult("fred", "ERROR", [], "FRED observation limit must be an integer between 1 and 100");
  if (query.observationStart !== undefined && !isDateOnly(query.observationStart)) return providerResult("fred", "ERROR", [], "FRED observation_start must be YYYY-MM-DD");
  if (query.observationEnd !== undefined && !isDateOnly(query.observationEnd)) return providerResult("fred", "ERROR", [], "FRED observation_end must be YYYY-MM-DD");
  if (query.observationStart && query.observationEnd && query.observationStart > query.observationEnd) return providerResult("fred", "ERROR", [], "FRED observation_start must not be after observation_end");
  if (query.requireCompleteRange && (!query.observationStart || !query.observationEnd)) return providerResult("fred", "ERROR", [], "FRED complete backfill requires explicit observation_start and observation_end");
  const allowedSeries = new Set<string>(MACRO_SERIES_REGISTRY.map((series) => series.seriesId));
  const requestedIds = query.seriesIds;
  if (requestedIds !== undefined && (
    !Array.isArray(requestedIds)
    || requestedIds.length === 0
    || requestedIds.length > MACRO_SERIES_REGISTRY.length
    || requestedIds.some((id) => typeof id !== "string" || !allowedSeries.has(id))
    || new Set(requestedIds).size !== requestedIds.length
  )) return providerResult("fred", "ERROR", [], "FRED series subset must contain unique registered series IDs");
  if (query.requireCompleteRange && requestedIds !== undefined) {
    return providerResult("fred", "ERROR", [], "FRED series subset is FORWARD-only");
  }
  const selectedSeries = requestedIds === undefined
    ? MACRO_SERIES_REGISTRY
    : MACRO_SERIES_REGISTRY.filter((series) => requestedIds.includes(series.seriesId));
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return providerResult("fred", "UNAVAILABLE", [], "FRED_API_KEY is not configured");

  const results = await Promise.all(selectedSeries.map((series) =>
    fetchFredSeriesObservations(series, apiKey, query)));
  const data = results.flatMap((result) => result.data);
  const failures = results.filter((result) => result.status === "ERROR").map((result) => result.message).filter(Boolean);
  const emptyCount = results.filter((result) => result.status === "EMPTY").length;

  if (data.length > 0) {
    const omitted = selectedSeries.length - results.filter((result) => result.status === "SUCCESS").length;
    if (query.requireCompleteRange && failures.length > 0) {
      return providerResult("fred", "ERROR", data, `FRED bounded backfill incomplete: ${failures.join("; ")}`);
    }
    return providerResult(
      "fred",
      "SUCCESS",
      data,
      omitted ? `${omitted} P0 series unavailable or invalid${failures.length ? `: ${failures.join("; ")}` : ""}` : undefined,
    );
  }

  if (failures.length > 0) return providerResult("fred", "ERROR", [], failures.join("; "));
  return providerResult("fred", emptyCount ? "EMPTY" : "UNAVAILABLE");
}
