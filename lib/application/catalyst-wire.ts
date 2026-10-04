import type { NewsItem } from "../data/types";
import type { Evidence } from "../domain/types";
import {
  gdeltGalSnapshotFromEvidence,
  GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY,
} from "./gdelt-gal-history";

export type CatalystSourceRole = "PRIMARY" | "MEDIA" | "DISCOVERY";
export type CatalystTimeBasis = "PUBLISHED" | "SOURCE_OR_FIRST_SEEN" | "DISCOVERED";
export type CatalystScope = "MAKRO" | "CRYPTO" | "BTC" | "GOLD";

export type CatalystWireItem = {
  id: string;
  sourceRole: CatalystSourceRole;
  scope: CatalystScope;
  sourceLabel: string;
  title: string;
  url: string;
  displayAt: string;
  timeBasis: CatalystTimeBasis;
};

export type CatalystWireReadModel = {
  asOf: string;
  items: CatalystWireItem[];
  discoveryFeedAt: string | null;
  mediaItemCount: number;
  discoveryItemCount: number;
};

const OFFICIAL_DOMAIN_LABELS: Record<string, string> = {
  "federalreserve.gov": "Federal Reserve",
  "sec.gov": "SEC",
  "treasury.gov": "U.S. Treasury",
  "bls.gov": "BLS",
  "bea.gov": "BEA",
  "cftc.gov": "CFTC",
  "boj.or.jp": "Bank of Japan",
  "mof.go.jp": "Japan MOF",
  "pbc.gov.cn": "PBoC",
  "stats.gov.cn": "NBS China",
  "gov.cn": "State Council China",
};

function parseHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function officialSourceLabel(url: string): string | null {
  const host = parseHost(url);
  if (!host) return null;
  for (const [domain, label] of Object.entries(OFFICIAL_DOMAIN_LABELS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return label;
  }
  return null;
}

function sourceFromUrl(url: string): string {
  return parseHost(url) ?? "Sumber tidak diketahui";
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&(?:amp;)?#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function displayTitle(title: string): string {
  return title
    .replace(/&(?:amp;)?#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function rolePriority(role: CatalystSourceRole): number {
  if (role === "PRIMARY") return 3;
  if (role === "MEDIA") return 2;
  return 1;
}

function validTimestamp(value: string | null | undefined): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function newsItems(
  items: NewsItem[],
  scope: "MAKRO" | "CRYPTO",
): CatalystWireItem[] {
  return items.flatMap((item) => {
    if (!item.title.trim() || !item.url.trim() || !validTimestamp(item.publishedAt)) return [];
    const primary = officialSourceLabel(item.url);
    return [{
      id: `news:${item.id}`,
      sourceRole: primary ? "PRIMARY" as const : "MEDIA" as const,
      scope,
      sourceLabel: primary ?? item.source,
      title: displayTitle(item.title),
      url: item.url,
      displayAt: item.publishedAt,
      timeBasis: "PUBLISHED" as const,
    }];
  });
}

function latestGdeltEvidence(evidence: Evidence[]): Array<{
  evidence: Evidence;
  snapshot: NonNullable<ReturnType<typeof gdeltGalSnapshotFromEvidence>>;
}> {
  const latest = new Map<"BTC" | "GOLD", {
    evidence: Evidence;
    snapshot: NonNullable<ReturnType<typeof gdeltGalSnapshotFromEvidence>>;
  }>();

  for (const item of evidence) {
    if (
      item.sourceId !== "gdelt"
      || item.kind !== "NEWS"
      || item.metadata?.methodology !== GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY
    ) continue;
    const snapshot = gdeltGalSnapshotFromEvidence(item);
    if (!snapshot) continue;
    const current = latest.get(snapshot.asset);
    if (
      !current
      || Date.parse(snapshot.feedLastBuildAt) > Date.parse(current.snapshot.feedLastBuildAt)
      || (
        snapshot.feedLastBuildAt === current.snapshot.feedLastBuildAt
        && Date.parse(item.retrievedAt) > Date.parse(current.evidence.retrievedAt)
      )
    ) {
      latest.set(snapshot.asset, { evidence: item, snapshot });
    }
  }

  return [...latest.values()];
}

function gdeltItems(evidence: Evidence[]): {
  items: CatalystWireItem[];
  discoveryFeedAt: string | null;
} {
  const latest = latestGdeltEvidence(evidence);
  const discoveryFeedAt = latest
    .map(({ snapshot }) => snapshot.feedLastBuildAt)
    .filter(validTimestamp)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

  const items = latest.flatMap(({ evidence: row, snapshot }) =>
    snapshot.candidates.flatMap((candidate, index): CatalystWireItem[] => {
      if (!candidate.title.trim() || !candidate.url.trim()) return [];
      const primary = officialSourceLabel(candidate.url);
      const hasProviderTime = validTimestamp(candidate.providerDate);
      const displayAt = hasProviderTime
        ? candidate.providerDate
        : validTimestamp(row.retrievedAt)
          ? row.retrievedAt
          : snapshot.feedLastBuildAt;

      return [{
        id: `gdelt:${snapshot.asset}:${normalizeUrl(candidate.url)}:${index}`,
        sourceRole: primary ? "PRIMARY" : "DISCOVERY",
        scope: snapshot.asset,
        sourceLabel: primary
          ? `${primary} · via GDELT`
          : `${sourceFromUrl(candidate.url)} · via GDELT`,
        title: displayTitle(candidate.title),
        url: candidate.url,
        displayAt,
        timeBasis: hasProviderTime ? "SOURCE_OR_FIRST_SEEN" : "DISCOVERED",
      }];
    }),
  );

  return { items, discoveryFeedAt };
}

export function buildCatalystWireReadModel(input: {
  macroNews: NewsItem[];
  cryptoNews: NewsItem[];
  gdeltEvidence: Evidence[];
  asOf: string;
  limit?: number;
}): CatalystWireReadModel {
  if (!validTimestamp(input.asOf)) {
    throw new Error("Catalyst Wire requires a valid asOf timestamp.");
  }
  const limit = input.limit ?? 8;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Catalyst Wire limit must be an integer between 1 and 20.");
  }

  const media = [
    ...newsItems(input.macroNews, "MAKRO"),
    ...newsItems(input.cryptoNews, "CRYPTO"),
  ];
  const discovery = gdeltItems(input.gdeltEvidence);
  const candidates = [...media, ...discovery.items]
    .filter((item) => Date.parse(item.displayAt) <= Date.parse(input.asOf))
    .sort((a, b) =>
      rolePriority(b.sourceRole) - rolePriority(a.sourceRole)
      || Date.parse(b.displayAt) - Date.parse(a.displayAt)
    );

  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: CatalystWireItem[] = [];
  for (const item of candidates) {
    const urlKey = normalizeUrl(item.url);
    const titleKey = normalizeTitle(item.title);
    if (!urlKey || !titleKey || seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    deduped.push(item);
  }

  deduped.sort((a, b) =>
    Date.parse(b.displayAt) - Date.parse(a.displayAt)
    || rolePriority(b.sourceRole) - rolePriority(a.sourceRole)
  );

  const items = deduped.slice(0, limit);
  return {
    asOf: input.asOf,
    items,
    discoveryFeedAt: discovery.discoveryFeedAt,
    mediaItemCount: items.filter((item) => item.sourceRole === "MEDIA").length,
    discoveryItemCount: items.filter((item) => item.sourceRole === "DISCOVERY").length,
  };
}
