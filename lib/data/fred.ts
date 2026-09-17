import "server-only";
import { MACRO_SERIES_REGISTRY, type MacroSeriesDefinition } from "./macro-registry";
import type { ProviderResult } from "./types";
import { providerResult } from "./types";

const FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations";

type FredObservation = { date?: string; value?: string; realtime_start?: string; realtime_end?: string };
type FredResponse = { observations?: FredObservation[]; error_message?: string };
type ValidFredObservation = FredObservation & { date: string; value: string };

/**
 * Source-native temporal fields are explicit. FRED's standard observations
 * response does not provide a per-observation publication/release timestamp,
 * so releasedAt remains null rather than being inferred from observationDate,
 * realtime_start, or P365 retrieval time.
 */
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

async function fetchSeries(series: MacroSeriesDefinition, apiKey: string): Promise<ProviderResult<MacroObservationInput>> {
  const url = new URL(FRED_OBSERVATIONS_URL);
  url.searchParams.set("series_id", series.seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "8");

  try {
    const response = await fetch(url, {
      next: { revalidate: series.revalidateSeconds, tags: ["p365-dashboard"] },
      signal: AbortSignal.timeout(10_000),
    });
    const retrievedAt = new Date().toISOString();

    if (!response.ok) {
      return providerResult("fred", "ERROR", [], `FRED ${series.seriesId} HTTP ${response.status}`, undefined, retrievedAt);
    }

    const payload = await response.json() as FredResponse;
    if (!Array.isArray(payload.observations)) {
      return providerResult("fred", "ERROR", [], payload.error_message ?? `FRED ${series.seriesId} response is malformed`, undefined, retrievedAt);
    }

    const valid = payload.observations
      .filter((item): item is ValidFredObservation => isValidCurrentOrPastDate(item.date ?? "") && isNumericValue(item.value))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (valid.length === 0) {
      return providerResult("fred", "EMPTY", [], `FRED ${series.seriesId} returned no valid observations`, undefined, retrievedAt);
    }

    return providerResult(
      "fred",
      "SUCCESS",
      valid.map((observation, index) => ({
        series,
        value: observation.value,
        observationDate: observation.date,
        previousValue: valid[index + 1]?.value ?? null,
        vintageDate: observation.realtime_start && isDateOnly(observation.realtime_start) ? observation.realtime_start : null,
        releasedAt: null,
        retrievedAt,
      })),
      undefined,
      undefined,
      retrievedAt,
    );
  } catch (error) {
    return providerResult("fred", "ERROR", [], error instanceof Error ? error.message : `FRED ${series.seriesId} request failed`);
  }
}

export async function fetchFredMacroObservations(): Promise<ProviderResult<MacroObservationInput>> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return providerResult("fred", "UNAVAILABLE", [], "FRED_API_KEY is not configured");

  const results = await Promise.all(MACRO_SERIES_REGISTRY.map((series) => fetchSeries(series, apiKey)));
  const data = results.flatMap((result) => result.data);
  const failures = results.filter((result) => result.status === "ERROR").map((result) => result.message).filter(Boolean);
  const emptyCount = results.filter((result) => result.status === "EMPTY").length;

  if (data.length > 0) {
    const omitted = MACRO_SERIES_REGISTRY.length - results.filter((result) => result.status === "SUCCESS").length;
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
