import "server-only";
import { MACRO_SERIES_REGISTRY, type MacroSeriesDefinition } from "./macro-registry";
import type { ProviderResult } from "./types";

const FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations";

type FredObservation = { date?: string; value?: string; realtime_start?: string; realtime_end?: string };
type FredResponse = { observations?: FredObservation[]; error_message?: string };
type ValidFredObservation = FredObservation & { date: string; value: string };

export type MacroObservationInput = {
  series: MacroSeriesDefinition;
  value: string;
  observationDate: string;
  previousValue: string | null;
  vintageDate: string | null;
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
    const response = await fetch(url, { next: { revalidate: series.revalidateSeconds, tags: ["p365-dashboard"] }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { status: "ERROR", data: [], message: `FRED ${series.seriesId} HTTP ${response.status}` };
    const payload = await response.json() as FredResponse;
    if (!Array.isArray(payload.observations)) return { status: "ERROR", data: [], message: payload.error_message ?? `FRED ${series.seriesId} response is malformed` };

    const valid = payload.observations
      .filter((item): item is ValidFredObservation => isValidCurrentOrPastDate(item.date ?? "") && isNumericValue(item.value))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (valid.length === 0) return { status: "EMPTY", data: [], message: `FRED ${series.seriesId} returned no valid observations` };

    return {
      status: "SUCCESS",
      data: valid.map((observation, index) => ({
        series,
        value: observation.value,
        observationDate: observation.date,
        previousValue: valid[index + 1]?.value ?? null,
        vintageDate: observation.realtime_start && isDateOnly(observation.realtime_start) ? observation.realtime_start : null,
      })),
    };
  } catch (error) {
    return { status: "ERROR", data: [], message: error instanceof Error ? error.message : `FRED ${series.seriesId} request failed` };
  }
}

export async function fetchFredMacroObservations(): Promise<ProviderResult<MacroObservationInput>> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return { status: "UNAVAILABLE", data: [], message: "FRED_API_KEY is not configured" };

  const results = await Promise.all(MACRO_SERIES_REGISTRY.map((series) => fetchSeries(series, apiKey)));
  const data = results.flatMap((result) => result.data);
  const failures = results.filter((result) => result.status === "ERROR").map((result) => result.message).filter(Boolean);
  const emptyCount = results.filter((result) => result.status === "EMPTY").length;

  if (data.length > 0) {
    const omitted = MACRO_SERIES_REGISTRY.length - results.filter((result) => result.status === "SUCCESS").length;
    return { status: "SUCCESS", data, message: omitted ? `${omitted} P0 series unavailable or invalid${failures.length ? `: ${failures.join("; ")}` : ""}` : undefined };
  }
  if (failures.length > 0) return { status: "ERROR", data: [], message: failures.join("; ") };
  return { status: emptyCount ? "EMPTY" : "UNAVAILABLE", data: [] };
}
