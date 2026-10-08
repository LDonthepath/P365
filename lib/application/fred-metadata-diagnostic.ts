import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { isCronRequestAuthorized } from "./cron-auth";

/**
 * FRS-001C: one series per authorized request, no canonical writes.
 * No provider error text, request URL or API key is returned or logged.
 */
const FRED_API_ORIGIN = "https://api.stlouisfed.org";
const RESPONSE_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 3_500;
const ALLOWED_SERIES = new Set<string>(MACRO_SERIES_REGISTRY.map((s) => s.seriesId));

type Check = "METADATA_FRED" | "TIDAK TERVERIFIKASI";
type DiagnosticField<T> = { provenance: Check; value: T | null };
type UpstreamResult = { ok: true; payload: Record<string, unknown> } | { ok: false };
type FredSeries = {
  seriesId: string;
  title: string;
  frequency: string;
  units: string;
  lastUpdated: string;
  observationStart: string;
  observationEnd: string;
};
type FredRelease = { releaseId: number; name: string };
type DiagnosticResult = {
  seriesId: string;
  checkedAt: string;
  series: DiagnosticField<FredSeries>;
  release: DiagnosticField<FredRelease>;
  publisherReleaseDates: DiagnosticField<string[]>;
  valueChangeVintageDates: DiagnosticField<string[]>;
  firstAvailableInFredAt: null;
  availabilityEvidence: "TIDAK TERVERIFIKASI";
  warning: "PUBLISHER_RELEASE_DATE_IS_NOT_FRED_AVAILABILITY";
  status: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function field<T>(value: T | null): DiagnosticField<T> {
  return { provenance: value === null ? "TIDAK TERVERIFIKASI" : "METADATA_FRED", value };
}

async function fredJson(
  endpoint: string,
  parameters: Record<string, string>,
  apiKey: string,
  fetcher: typeof fetch,
): Promise<UpstreamResult> {
  const url = new URL("/fred/" + endpoint, FRED_API_ORIGIN);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false };
    const payload = asObject(await response.json());
    return payload ? { ok: true, payload } : { ok: false };
  } catch {
    // Never surface upstream error text: it may include the credentialed URL.
    return { ok: false };
  }
}
function firstItem(payload: UpstreamResult, property: string): Record<string, unknown> | null {
  if (!payload.ok) return null;
  const values = payload.payload[property];
  return Array.isArray(values) ? asObject(values[0]) : null;
}
function readSeries(payload: UpstreamResult, requestedId: string): FredSeries | null {
  const item = firstItem(payload, "seriess");
  if (!item || item.id !== requestedId) return null;
  const fields = ["title", "frequency", "units", "last_updated", "observation_start", "observation_end"] as const;
  if (!fields.every((key) => typeof item[key] === "string" && (item[key] as string).length > 0)) return null;
  if (!validDate(item.observation_start) || !validDate(item.observation_end)) return null;
  return {
    seriesId: requestedId,
    title: item.title as string,
    frequency: item.frequency as string,
    units: item.units as string,
    lastUpdated: item.last_updated as string,
    observationStart: item.observation_start,
    observationEnd: item.observation_end,
  };
}
function readRelease(payload: UpstreamResult): FredRelease | null {
  const item = firstItem(payload, "releases");
  return item && Number.isSafeInteger(item.id) && (item.id as number) > 0
    && typeof item.name === "string" && item.name.length > 0
    ? { releaseId: item.id as number, name: item.name }
    : null;
}
function readReleaseDates(payload: UpstreamResult, releaseId: number): string[] | null {
  if (!payload.ok || !Array.isArray(payload.payload.release_dates)) return null;
  const dates = payload.payload.release_dates;
  if (dates.some((x) => {
    const row = asObject(x);
    return !row || row.release_id !== releaseId || !validDate(row.date);
  })) return null;
  return dates.map((x) => (x as { date: string }).date);
}
function readVintageDates(payload: UpstreamResult): string[] | null {
  if (!payload.ok || !Array.isArray(payload.payload.vintage_dates)) return null;
  const dates = payload.payload.vintage_dates;
  return dates.every(validDate) ? dates : null;
}

export async function inspectFredSeriesMetadata(
  seriesId: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<DiagnosticResult> {
  if (!ALLOWED_SERIES.has(seriesId)) throw new Error("Series must be in P365 registry");
  const checkedAt = new Date().toISOString();
  const [seriesResponse, releaseResponse, vintagesResponse] = await Promise.all([
    fredJson("series", { series_id: seriesId }, apiKey, fetcher),
    fredJson("series/release", { series_id: seriesId }, apiKey, fetcher),
    fredJson("series/vintagedates", {
      series_id: seriesId,
      sort_order: "desc",
      limit: String(RESPONSE_LIMIT),
    }, apiKey, fetcher),
  ]);
  const series = readSeries(seriesResponse, seriesId);
  const release = readRelease(releaseResponse);
  const datesResponse = release
    ? await fredJson("release/dates", {
      release_id: String(release.releaseId),
      sort_order: "desc",
      limit: String(RESPONSE_LIMIT),
      include_release_dates_with_no_data: "false",
    }, apiKey, fetcher)
    : null;
  const publisherReleaseDates = datesResponse && release
    ? readReleaseDates(datesResponse, release.releaseId)
    : null;
  const valueChangeVintageDates = readVintageDates(vintagesResponse);
  const verified = [series, release, publisherReleaseDates, valueChangeVintageDates]
    .filter((x) => x !== null).length;
  return {
    seriesId,
    checkedAt,
    series: field(series),
    release: field(release),
    publisherReleaseDates: field(publisherReleaseDates),
    valueChangeVintageDates: field(valueChangeVintageDates),
    firstAvailableInFredAt: null,
    availabilityEvidence: "TIDAK TERVERIFIKASI",
    warning: "PUBLISHER_RELEASE_DATE_IS_NOT_FRED_AVAILABILITY",
    status: verified === 4 ? "COMPLETE" : verified === 0 ? "UNAVAILABLE" : "PARTIAL",
  };
}

/** Auth occurs before input validation or any outbound request. */
export function createFredMetadataDiagnosticHandler(
  fetcher: typeof fetch = fetch,
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
  readFredKey: () => string | undefined = () => process.env.FRED_API_KEY,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const headers = { "Cache-Control": "private, no-store, max-age=0" };
    if (!isCronRequestAuthorized(request.headers.get("authorization"), readSecret())) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    }
    const params = new URL(request.url).searchParams;
    const seriesIds = params.getAll("seriesId");
    if (request.method !== "GET" || [...params.keys()].some((key) => key !== "seriesId")
        || seriesIds.length !== 1 || !ALLOWED_SERIES.has(seriesIds[0])) {
      return Response.json({ error: "Provide one registered seriesId" }, { status: 400, headers });
    }
    const key = readFredKey();
    if (!key) return Response.json({ error: "FRED metadata unavailable" }, { status: 503, headers });
    const result = await inspectFredSeriesMetadata(seriesIds[0], key, fetcher);
    return Response.json(result, { status: result.status === "UNAVAILABLE" ? 502 : 200, headers });
  };
}
