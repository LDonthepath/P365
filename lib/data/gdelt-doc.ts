import "server-only";

import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const GDELT_DOC_SOURCE_ID = "gdelt" as const;
export const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc" as const;
export const GDELT_MAX_RECORDS = 250;
export const GDELT_DEFAULT_MAX_RECORDS = 50;
export const GDELT_MAX_WINDOW_MS = 6 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 15_000;

export type GdeltMoveAsset = "BTC" | "GOLD";
export type GdeltProviderDateSemantics = "PUBLICATION_OR_FIRST_SEEN";

export type GdeltCandidateArticle = {
  asset: GdeltMoveAsset;
  url: string;
  title: string;
  domain: string;
  language: string | null;
  sourceCountry: string | null;
  providerDate: string;
  providerDateSemantics: GdeltProviderDateSemantics;
  query: string;
};

export type GdeltMoveWindowQuery = {
  asset: GdeltMoveAsset;
  startAt: string;
  endAt: string;
  maxRecords?: number;
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
};

const QUERY_BY_ASSET: Record<GdeltMoveAsset, string> = {
  BTC: '("bitcoin" OR "BTC")',
  GOLD: '("gold price" OR "XAU" OR "gold market" OR "bullion")',
};

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`GDELT malformed payload: ${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDate(value: unknown, label: string): string {
  const raw = nonEmptyString(value, label);
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  if (compact) {
    const [, y, m, d, hh, mm, ss] = compact;
    const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}.000Z`;
    const time = Date.parse(iso);
    if (!Number.isFinite(time)) throw new Error(`GDELT malformed payload: ${label} is invalid`);
    return new Date(time).toISOString();
  }
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) throw new Error(`GDELT malformed payload: ${label} is invalid`);
  return new Date(time).toISOString();
}

function domainFromUrl(url: string, providerDomain: unknown): string {
  const supplied = optionalString(providerDomain);
  if (supplied) return supplied.toLowerCase();
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error("GDELT malformed payload: article url is invalid");
  }
}

function parseArticle(
  candidate: unknown,
  index: number,
  asset: GdeltMoveAsset,
  query: string,
): GdeltCandidateArticle {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`GDELT malformed payload: articles[${index}] must be an object`);
  }
  const row = candidate as Record<string, unknown>;
  const url = nonEmptyString(row.url, `articles[${index}].url`);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`GDELT malformed payload: articles[${index}].url must be http(s)`);
  }

  return {
    asset,
    url,
    title: nonEmptyString(row.title, `articles[${index}].title`),
    domain: domainFromUrl(url, row.domain),
    language: optionalString(row.language),
    sourceCountry: optionalString(row.sourcecountry),
    providerDate: parseDate(row.seendate, `articles[${index}].seendate`),
    providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN",
    query,
  };
}

function validateWindow(input: GdeltMoveWindowQuery, now: Date): { startMs: number; endMs: number; maxRecords: number } {
  const startMs = Date.parse(input.startAt);
  const endMs = Date.parse(input.endAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error("GDELT move window requires valid ISO startAt/endAt");
  }
  if (startMs >= endMs) {
    throw new Error("GDELT move window requires startAt < endAt");
  }
  if (endMs - startMs > GDELT_MAX_WINDOW_MS) {
    throw new Error("GDELT move window must not exceed 6 hours");
  }
  if (endMs > now.getTime() + 60_000) {
    throw new Error("GDELT move window endAt must not be materially in the future");
  }
  const maxRecords = input.maxRecords ?? GDELT_DEFAULT_MAX_RECORDS;
  if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > GDELT_MAX_RECORDS) {
    throw new Error(`GDELT maxRecords must be an integer between 1 and ${GDELT_MAX_RECORDS}`);
  }
  return { startMs, endMs, maxRecords };
}

function gdeltDate(ms: number): string {
  const iso = new Date(ms).toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(`GDELT HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("GDELT invalid JSON response");
  }
}

export function gdeltQueryForAsset(asset: GdeltMoveAsset): string {
  return QUERY_BY_ASSET[asset];
}

export async function fetchGdeltMoveWindowArticles(
  input: GdeltMoveWindowQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<GdeltCandidateArticle>> {
  const now = dependencies.now ?? (() => new Date());
  const retrieved = now();

  try {
    const { startMs, endMs, maxRecords } = validateWindow(input, retrieved);
    const query = gdeltQueryForAsset(input.asset);
    const url = new URL(GDELT_DOC_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("mode", "artlist");
    url.searchParams.set("format", "json");
    url.searchParams.set("sort", "datedesc");
    url.searchParams.set("maxrecords", String(maxRecords));
    url.searchParams.set("startdatetime", gdeltDate(startMs));
    url.searchParams.set("enddatetime", gdeltDate(endMs));

    const response = await (dependencies.fetch ?? fetch)(url.toString(), {
      headers: { accept: "application/json" },
      ...providerFetchPolicy(input.acquisitionMode ?? "FRESH", 300),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = await responseJson(response);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("GDELT malformed payload: response must be an object");
    }
    const row = payload as Record<string, unknown>;
    if (!Array.isArray(row.articles)) {
      throw new Error("GDELT malformed payload: articles must be an array");
    }

    const deduped = new Map<string, GdeltCandidateArticle>();
    row.articles.forEach((candidate, index) => {
      const article = parseArticle(candidate, index, input.asset, query);
      const providerMs = Date.parse(article.providerDate);
      if (providerMs < startMs || providerMs > endMs) {
        throw new Error(`GDELT malformed payload: article providerDate falls outside requested window: ${article.url}`);
      }
      if (!deduped.has(article.url)) deduped.set(article.url, article);
    });

    const data = [...deduped.values()].sort(
      (left, right) => Date.parse(right.providerDate) - Date.parse(left.providerDate)
        || left.url.localeCompare(right.url),
    );
    const retrievedAt = retrieved.toISOString();

    return providerResult(
      GDELT_DOC_SOURCE_ID,
      data.length > 0 ? "SUCCESS" : "EMPTY",
      data,
      data.length > 0 ? undefined : "GDELT returned no candidate articles in the move window",
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = retrieved.toISOString();
    return providerResult(
      GDELT_DOC_SOURCE_ID,
      "ERROR",
      [],
      error instanceof Error ? error.message : "GDELT request failed",
      undefined,
      retrievedAt,
    );
  }
}
