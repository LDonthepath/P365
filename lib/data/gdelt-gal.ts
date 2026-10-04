import "server-only";

import { XMLParser } from "fast-xml-parser";
import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const GDELT_GAL_SOURCE_ID = "gdelt" as const;
export const GDELT_GAL_RSS_URL = "https://data.gdeltproject.org/gdeltv3/gal/feed.rss" as const;
export const GDELT_GAL_ROLLING_WINDOW_MS = 15 * 60 * 1000;
export const GDELT_GAL_DEFAULT_MAX_CANDIDATES = 30;
export const GDELT_GAL_MAX_CANDIDATES = 100;

const REQUEST_TIMEOUT_MS = 15_000;

export type GdeltMoveAsset = "BTC" | "GOLD";
export type GdeltProviderDateSemantics = "PUBLICATION_OR_FIRST_SEEN" | "UNAVAILABLE";

export type GdeltGalCandidateArticle = {
  asset: GdeltMoveAsset;
  url: string;
  title: string;
  domain: string;
  providerDate: string | null;
  providerDateSemantics: GdeltProviderDateSemantics;
};

export type GdeltGalFeedSnapshot = {
  asset: GdeltMoveAsset;
  feedLastBuildAt: string;
  feedWindowStartAt: string;
  coverage: "ROLLING_15_MINUTES";
  totalFeedItems: number;
  invalidItemCount: number;
  candidates: GdeltGalCandidateArticle[];
};

export type GdeltGalQuery = {
  asset: GdeltMoveAsset;
  maxCandidates?: number;
  acquisitionMode?: ProviderAcquisitionMode;
};

export type GdeltGalMultiQuery = {
  assets: GdeltMoveAsset[];
  maxCandidates?: number;
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
};

type RssItem = {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
};

function parseOptionalDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function domainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    return parsed.hostname.toLowerCase();
  } catch {
    throw new Error("GDELT GAL malformed payload: article link must be a valid http(s) URL");
  }
}

function normalizedSearchText(title: string, url: string): string {
  return `${title} ${url}`.toLowerCase();
}

function isAssetCandidate(asset: GdeltMoveAsset, title: string, url: string): boolean {
  const text = normalizedSearchText(title, url);
  if (asset === "BTC") {
    return /\bbitcoin\b|\bbtc\b/.test(text);
  }

  const assetMention = /\bgold\b|\bxau\b|\bbullion\b/.test(text);
  if (!assetMention) return false;
  if (/\bxau\b|\bbullion\b/.test(text)) return true;

  const marketContext =
    /\bprice\b|\bmarket\b|\bfutures?\b|\betf\b|\btrading\b|\binvest(?:or|ment|ing)?\b|\bfed\b|\bdollar\b|\byields?\b|\brates?\b|\bcentral bank\b|\bsafe haven\b|\brecord high\b|\bsurges?\b|\brises?\b|\bfalls?\b|\bdrops?\b|\bclimbs?\b|\bslides?\b/.test(text);
  const obviousNonMarket =
    /\bgold medal\b|\bgolden globe\b|\bgold coast\b|\bgold cup\b|\bgold award\b/.test(text);

  return marketContext && !obviousNonMarket;
}

function validateMaxCandidates(value: number | undefined): number {
  const maxCandidates = value ?? GDELT_GAL_DEFAULT_MAX_CANDIDATES;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > GDELT_GAL_MAX_CANDIDATES) {
    throw new Error(`GDELT GAL maxCandidates must be an integer between 1 and ${GDELT_GAL_MAX_CANDIDATES}`);
  }
  return maxCandidates;
}

function validateAssets(assets: GdeltMoveAsset[]): GdeltMoveAsset[] {
  const unique = [...new Set(assets)];
  if (unique.length === 0) throw new Error("GDELT GAL requires at least one asset");
  if (unique.some((asset) => asset !== "BTC" && asset !== "GOLD")) {
    throw new Error("GDELT GAL supports only BTC and GOLD");
  }
  return unique;
}

function parseFeed(xml: string): {
  feedLastBuildAt: string;
  items: RssItem[];
} {
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("GDELT GAL malformed payload: RSS root must be an object");
  }

  const rss = parsed as Record<string, unknown>;
  const channelCandidate =
    rss.rss && typeof rss.rss === "object" && !Array.isArray(rss.rss)
      ? (rss.rss as Record<string, unknown>).channel
      : undefined;
  if (!channelCandidate || typeof channelCandidate !== "object" || Array.isArray(channelCandidate)) {
    throw new Error("GDELT GAL malformed payload: channel must be an object");
  }

  const channel = channelCandidate as Record<string, unknown>;
  const feedLastBuildAt = parseOptionalDate(channel.lastBuildDate);
  if (!feedLastBuildAt) {
    throw new Error("GDELT GAL malformed payload: lastBuildDate is missing or invalid");
  }

  const rawItems = channel.item;
  const items: RssItem[] = Array.isArray(rawItems)
    ? rawItems as RssItem[]
    : rawItems && typeof rawItems === "object"
      ? [rawItems as RssItem]
      : [];

  return { feedLastBuildAt, items };
}

function snapshotForAsset(input: {
  asset: GdeltMoveAsset;
  feedLastBuildAt: string;
  items: RssItem[];
  maxCandidates: number;
}): GdeltGalFeedSnapshot {
  const deduped = new Map<string, GdeltGalCandidateArticle>();
  let invalidItemCount = 0;

  for (const item of input.items) {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const url = typeof item.link === "string" ? item.link.trim() : "";
    if (!title || !url) {
      invalidItemCount += 1;
      continue;
    }

    let domain: string;
    try {
      domain = domainFromUrl(url);
    } catch {
      invalidItemCount += 1;
      continue;
    }

    if (!isAssetCandidate(input.asset, title, url)) continue;
    if (deduped.has(url)) continue;

    const providerDate = parseOptionalDate(item.pubDate);
    deduped.set(url, {
      asset: input.asset,
      url,
      title,
      domain,
      providerDate,
      providerDateSemantics: providerDate ? "PUBLICATION_OR_FIRST_SEEN" : "UNAVAILABLE",
    });

    if (deduped.size >= input.maxCandidates) break;
  }

  const lastBuildMs = Date.parse(input.feedLastBuildAt);
  return {
    asset: input.asset,
    feedLastBuildAt: input.feedLastBuildAt,
    feedWindowStartAt: new Date(lastBuildMs - GDELT_GAL_ROLLING_WINDOW_MS).toISOString(),
    coverage: "ROLLING_15_MINUTES",
    totalFeedItems: input.items.length,
    invalidItemCount,
    candidates: [...deduped.values()],
  };
}

export async function fetchGdeltGalCandidateSnapshots(
  query: GdeltGalMultiQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<GdeltGalFeedSnapshot>> {
  const now = dependencies.now ?? (() => new Date());
  const retrievedAt = now().toISOString();

  try {
    const assets = validateAssets(query.assets);
    const maxCandidates = validateMaxCandidates(query.maxCandidates);
    const response = await (dependencies.fetch ?? fetch)(GDELT_GAL_RSS_URL, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
      ...providerFetchPolicy(query.acquisitionMode ?? "FRESH", 60),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
      throw new Error(`GDELT GAL HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const xml = await response.text();
    const feed = parseFeed(xml);
    const snapshots = assets.map((asset) => snapshotForAsset({
      asset,
      feedLastBuildAt: feed.feedLastBuildAt,
      items: feed.items,
      maxCandidates,
    }));
    const totalCandidates = snapshots.reduce((sum, snapshot) => sum + snapshot.candidates.length, 0);

    return providerResult(
      GDELT_GAL_SOURCE_ID,
      "SUCCESS",
      snapshots,
      totalCandidates > 0 ? undefined : "GDELT GAL feed contained no matching asset candidates",
      undefined,
      retrievedAt,
    );
  } catch (error) {
    return providerResult(
      GDELT_GAL_SOURCE_ID,
      "ERROR",
      [],
      error instanceof Error ? error.message : "GDELT GAL request failed",
      undefined,
      retrievedAt,
    );
  }
}

export async function fetchGdeltGalCandidateSnapshot(
  query: GdeltGalQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<GdeltGalFeedSnapshot>> {
  const result = await fetchGdeltGalCandidateSnapshots({
    assets: [query.asset],
    maxCandidates: query.maxCandidates,
    acquisitionMode: query.acquisitionMode,
  }, dependencies);

  return result;
}
