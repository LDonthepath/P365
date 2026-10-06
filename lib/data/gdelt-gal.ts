import "server-only";

import { extractGdeltMacroCandidates } from "./gdelt-macro-topics";
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
export type GdeltCandidateCoverage = "COMPLETE" | "TRUNCATED";

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
  matchingCandidateCount: number;
  candidateCoverage: GdeltCandidateCoverage;
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

type ValidFeedItem = {
  title: string;
  url: string;
  domain: string;
  providerDate: string | null;
  providerDateSemantics: GdeltProviderDateSemantics;
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

  const genericGoldMention = /\bgold\b/.test(text);
  const bullionMention = /\bbullion\b/.test(text);
  // XAU collides with ordinary words in some languages once URLs are lower-cased
  // (for example Vietnamese `tin-xau`). Treat it as a ticker only when the
  // article title carries an explicit upper-case XAU/XAUUSD token.
  const explicitXauTicker = /\bXAU(?:USD)?\b/.test(title);
  if (!genericGoldMention && !bullionMention && !explicitXauTicker) return false;
  if (bullionMention || explicitXauTicker) return true;

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
  rawItems: RssItem[];
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

  const raw = channel.item;
  const rawItems: RssItem[] = Array.isArray(raw)
    ? raw as RssItem[]
    : raw && typeof raw === "object"
      ? [raw as RssItem]
      : [];

  return { feedLastBuildAt, rawItems };
}

function normalizeFeedItems(rawItems: RssItem[]): {
  items: ValidFeedItem[];
  invalidItemCount: number;
} {
  const items: ValidFeedItem[] = [];
  let invalidItemCount = 0;

  for (const item of rawItems) {
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

    const providerDate = parseOptionalDate(item.pubDate);
    items.push({
      title,
      url,
      domain,
      providerDate,
      providerDateSemantics: providerDate ? "PUBLICATION_OR_FIRST_SEEN" : "UNAVAILABLE",
    });
  }

  return { items, invalidItemCount };
}

function snapshotForAsset(input: {
  asset: GdeltMoveAsset;
  feedLastBuildAt: string;
  totalFeedItems: number;
  invalidItemCount: number;
  items: ValidFeedItem[];
  maxCandidates: number;
}): GdeltGalFeedSnapshot {
  const seenUrls = new Set<string>();
  const candidates: GdeltGalCandidateArticle[] = [];
  let matchingCandidateCount = 0;

  for (const item of input.items) {
    if (!isAssetCandidate(input.asset, item.title, item.url)) continue;
    if (seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    matchingCandidateCount += 1;

    if (candidates.length < input.maxCandidates) {
      candidates.push({
        asset: input.asset,
        url: item.url,
        title: item.title,
        domain: item.domain,
        providerDate: item.providerDate,
        providerDateSemantics: item.providerDateSemantics,
      });
    }
  }

  const lastBuildMs = Date.parse(input.feedLastBuildAt);
  return {
    asset: input.asset,
    feedLastBuildAt: input.feedLastBuildAt,
    feedWindowStartAt: new Date(lastBuildMs - GDELT_GAL_ROLLING_WINDOW_MS).toISOString(),
    coverage: "ROLLING_15_MINUTES",
    totalFeedItems: input.totalFeedItems,
    invalidItemCount: input.invalidItemCount,
    matchingCandidateCount,
    candidateCoverage: matchingCandidateCount > candidates.length ? "TRUNCATED" : "COMPLETE",
    candidates,
  };
}

async function acquireGalFeed(acquisitionMode: ProviderAcquisitionMode, dependencies: Dependencies) {
  const response = await (dependencies.fetch ?? fetch)(GDELT_GAL_RSS_URL, {
    headers: { accept: "application/rss+xml, application/xml, text/xml" },
    ...providerFetchPolicy(acquisitionMode, 60),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(`GDELT GAL HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const xml = await response.text();
  const feed = parseFeed(xml);
  const normalized = normalizeFeedItems(feed.rawItems);
  return { feed, normalized, inputRssBytes: new TextEncoder().encode(xml).byteLength };
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
    const { feed, normalized } = await acquireGalFeed(query.acquisitionMode ?? "FRESH", dependencies);
    const snapshots = assets.map((asset) => snapshotForAsset({
      asset,
      feedLastBuildAt: feed.feedLastBuildAt,
      totalFeedItems: feed.rawItems.length,
      invalidItemCount: normalized.invalidItemCount,
      items: normalized.items,
      maxCandidates,
    }));
    const totalCandidates = snapshots.reduce(
      (sum, snapshot) => sum + snapshot.matchingCandidateCount,
      0,
    );

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
  return fetchGdeltGalCandidateSnapshots({
    assets: [query.asset],
    maxCandidates: query.maxCandidates,
    acquisitionMode: query.acquisitionMode,
  }, dependencies);
}

/** Read-only qualification: one acquisition supplies unchanged asset projections and macro discovery. */
export async function qualifyGdeltGalSharedFeed(dependencies: Dependencies = {}) {
  const retrievedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  const started = performance.now();
  try {
    const { feed, normalized, inputRssBytes } = await acquireGalFeed("FRESH", dependencies);
    const assetSnapshots = (["BTC", "GOLD"] as const).map((asset) => snapshotForAsset({
      asset, feedLastBuildAt: feed.feedLastBuildAt, totalFeedItems: feed.rawItems.length,
      invalidItemCount: normalized.invalidItemCount, items: normalized.items, maxCandidates: 30,
    }));
    return providerResult(GDELT_GAL_SOURCE_ID, "SUCCESS", [{
      writesPerformed: false as const, elapsedMs: Math.round(performance.now() - started),
      inputRssBytes, feedLastBuildAt: feed.feedLastBuildAt,
      feedWindowStartAt: assetSnapshots[0].feedWindowStartAt,
      coverage: "ROLLING_15_MINUTES" as const, totalFeedItems: feed.rawItems.length,
      invalidItemCount: normalized.invalidItemCount,
      maxInputTitleCharacters: normalized.items.reduce((max, item) => Math.max(max, item.title.length), 0),
      maxInputUrlCharacters: normalized.items.reduce((max, item) => Math.max(max, item.url.length), 0),
      assetSnapshots, macro: extractGdeltMacroCandidates(normalized.items),
    }], undefined, undefined, retrievedAt);
  } catch (error) {
    return providerResult<never>(GDELT_GAL_SOURCE_ID, "ERROR", [],
      error instanceof Error ? error.message : "GDELT GAL qualification failed", undefined, retrievedAt);
  }
}
