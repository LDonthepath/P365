import type { MacroSeriesDefinition } from "./macro-registry";
import type { ProviderResult } from "./types";
import { providerResult } from "./types";
import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";

const FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations";

type FredObservation = { date?: string; value?: string; realtime_start?: string; realtime_end?: string };
type FredResponse = {
  count?: number;
  offset?: number;
  limit?: number;
  observations?: FredObservation[];
  error_message?: string;
};
type RetrievedFredObservation = { observation: FredObservation; retrievedAt: string };
type ValidFredObservation = RetrievedFredObservation & { observation: FredObservation & { date: string; value: string } };

export type FredObservationQuery = {
  observationStart?: string;
  observationEnd?: string;
  limit?: number;
  acquisitionMode?: ProviderAcquisitionMode;
  requireCompleteRange?: boolean;
};

export type MacroObservationInput = {
  series: MacroSeriesDefinition;
  value: string;
  observationDate: string;
  previousValue: string | null;
  vintageDate: string | null;
  releasedAt: string | null;
  retrievedAt: string;
};

function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isNumericValue(value: string | undefined): value is string {
  return Boolean(value && value !== "." && Number.isFinite(Number(value)));
}

function isValidCurrentOrPastDate(value: string): boolean {
  return isDateOnly(value) && value <= new Date().toISOString().slice(0, 10);
}

function completePageMetadata(payload: FredResponse): payload is FredResponse & {
  count: number;
  offset: number;
  limit: number;
  observations: FredObservation[];
} {
  return Number.isInteger(payload.count) && payload.count! >= 0
    && Number.isInteger(payload.offset) && payload.offset! >= 0
    && Number.isInteger(payload.limit) && payload.limit! >= 1
    && Array.isArray(payload.observations);
}

function errorResult(series: MacroSeriesDefinition, message: string, data: MacroObservationInput[] = []): ProviderResult<MacroObservationInput> {
  return providerResult("fred", "ERROR", data, `FRED ${series.seriesId} ${message}`);
}

/**
 * Fetch one FRED series. Bounded backfills require FRED pagination metadata and
 * continue until count/offset prove that the requested range is exhausted.
 */
export async function fetchFredSeriesObservations(
  series: MacroSeriesDefinition,
  apiKey: string,
  query: FredObservationQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult<MacroObservationInput>> {
  if (query.requireCompleteRange && (!query.observationStart || !query.observationEnd)) {
    return errorResult(series, "complete backfill requires explicit observation_start and observation_end");
  }

  const requestedLimit = query.limit ?? 8;
  const retrieved: RetrievedFredObservation[] = [];
  let requestedOffset = 0;
  let expectedCount: number | undefined;

  while (true) {
    const url = new URL(FRED_OBSERVATIONS_URL);
    url.searchParams.set("series_id", series.seriesId);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("sort_order", "desc");
    url.searchParams.set("limit", String(requestedLimit));
    if (query.requireCompleteRange) url.searchParams.set("offset", String(requestedOffset));
    if (query.observationStart) url.searchParams.set("observation_start", query.observationStart);
    if (query.observationEnd) url.searchParams.set("observation_end", query.observationEnd);

    try {
      const response = await fetchImpl(url, {
        ...providerFetchPolicy(query.acquisitionMode ?? "CACHED", series.revalidateSeconds),
        signal: AbortSignal.timeout(10_000),
      });
      const retrievedAt = new Date().toISOString();

      if (!response.ok) {
        return errorResult(series, `HTTP ${response.status}`);
      }

      const payload = await response.json() as FredResponse;
      if (!Array.isArray(payload.observations)) {
        return errorResult(series, payload.error_message ?? "response is malformed");
      }

      if (query.requireCompleteRange) {
        if (!completePageMetadata(payload)) {
          return errorResult(series, "response cannot prove bounded-range completeness");
        }
        if (payload.offset !== requestedOffset || payload.limit !== requestedLimit) {
          return errorResult(series, "pagination metadata does not match the requested page");
        }
        if (expectedCount === undefined) expectedCount = payload.count;
        if (payload.count !== expectedCount) {
          return errorResult(series, "observation count changed during pagination");
        }
        const outsideRange = payload.observations.find((item) =>
          isDateOnly(item.date) && (item.date < query.observationStart! || item.date > query.observationEnd!));
        if (outsideRange) {
          return errorResult(series, `returned observation outside requested range: ${outsideRange.date}`);
        }
      }

      retrieved.push(...payload.observations.map((observation) => ({ observation, retrievedAt })));
      if (!query.requireCompleteRange) break;

      const total = expectedCount!;
      const nextOffset = requestedOffset + payload.observations.length;
      if (nextOffset >= total) break;
      if (nextOffset === requestedOffset) {
        return errorResult(series, `pagination stopped at offset ${requestedOffset} before ${total} observations were exhausted`);
      }
      requestedOffset = nextOffset;
    } catch (error) {
      return errorResult(series, error instanceof Error ? error.message : "request failed");
    }
  }

  const valid = retrieved
    .filter((item): item is ValidFredObservation =>
      isValidCurrentOrPastDate(item.observation.date ?? "") && isNumericValue(item.observation.value))
    .sort((a, b) => b.observation.date.localeCompare(a.observation.date));

  if (valid.length === 0) {
    return providerResult("fred", "EMPTY", [], `FRED ${series.seriesId} returned no valid observations`);
  }

  return providerResult(
    "fred",
    "SUCCESS",
    valid.map((item, index) => ({
      series,
      value: item.observation.value,
      observationDate: item.observation.date,
      previousValue: valid[index + 1]?.observation.value ?? null,
      vintageDate: item.observation.realtime_start && isDateOnly(item.observation.realtime_start)
        ? item.observation.realtime_start
        : null,
      releasedAt: null,
      retrievedAt: item.retrievedAt,
    })),
  );
}
