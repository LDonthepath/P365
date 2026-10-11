import type { CalendarEvent, NewsItem } from "../data/types";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { buildDashboardContexts } from "../domain/context";
import { qualityFromMacroCadence, qualityFromMarketHours, freshnessPolicyForFamily, type MarketFreshnessCalendar } from "../domain/freshness";
import type { DataQuality, Event, Evidence, Observation, ProviderHealth } from "../domain/types";
import type { NormalizedDashboardData } from "../normalization/dashboard-normalization";
import {
  YAHOO_MARKET_SERIES, aggregateYahooHealth, yahooSeriesUnavailable,
  type YahooSeriesHealth,
} from "../normalization/yahoo-market-health";
import type { HistoricalObservationRepository, HistoricalEvidenceRepository, HistoricalEventRepository } from "../repositories/types";
import { compareObservationHistory } from "../repositories/observation-history";

/**
 * Read-side projection ONLY. Cron workers own provider acquisition and canonical
 * writes; opening or refreshing the dashboard must never poll a live provider.
 * Missing history is explicitly unavailable, not silently replaced by a quote.
 */
export type DurableDashboardRepositories = {
  observations: HistoricalObservationRepository;
  evidence: HistoricalEvidenceRepository;
  events: HistoricalEventRepository;
};

type Series = { domain: Observation["domain"]; seriesKey: string; sourceId: string; calendar?: MarketFreshnessCalendar };
const MARKET_SERIES: readonly Series[] = [
  { domain: "ASSET", seriesKey: "btc.spot.usd", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "ASSET", seriesKey: "eth.spot.usd", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "ASSET", seriesKey: "btc.market_cap.usd", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "ASSET", seriesKey: "eth.market_cap.usd", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "ASSET", seriesKey: "btc.volume_24h.usd", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "ASSET", seriesKey: "eth.volume_24h.usd", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "MARKET", seriesKey: "crypto.total_market_cap.usd", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "MARKET", seriesKey: "crypto.total_volume_24h.usd", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "MARKET", seriesKey: "crypto.btc_dominance.pct", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "MARKET", seriesKey: "crypto.eth_dominance.pct", sourceId: "coingecko-market", calendar: "CONTINUOUS_24_7" },
  { domain: "ASSET", seriesKey: "gold.futures.usd", sourceId: "yahoo-finance", calendar: "CME_GLOBEX_GOLD" },
  { domain: "ASSET", seriesKey: "russell2000.index.usd", sourceId: "yahoo-finance", calendar: "RUSSELL_2000_CASH_INDEX" },
  { domain: "ASSET", seriesKey: "dxy.index.usd", sourceId: "yahoo-finance", calendar: "ICE_USDX" },
];
const SERIES: readonly Series[] = [
  ...MACRO_SERIES_REGISTRY.map((series) => ({
    domain: series.domain,
    seriesKey: series.seriesId,
    sourceId: "fred",
  })),
  ...MARKET_SERIES,
];
const NEWS_SOURCES = ["alpha-vantage", "coindesk-rss"] as const;
const PROVIDERS = ["alpha-vantage", "coindesk-rss", "forex-factory", "biquote", "coingecko-market", "yahoo-finance", "fred", "federal-reserve"] as const;

function validAt(when: string, asOf: string): boolean {
  const value = Date.parse(when);
  return Number.isFinite(value) && value <= Date.parse(asOf);
}

function evaluatedQuality(item: Observation, series: Series, asOf: string): DataQuality {
  // Historical immutable ingestion quality remains a lower bound of certainty.
  if (item.quality !== "FRESH") return item.quality;
  const def = MACRO_SERIES_REGISTRY.find((candidate) =>
    series.sourceId === "fred" && candidate.seriesId === series.seriesKey);
  if (def) return qualityFromMacroCadence({
    observationDate: item.observedAt.slice(0, 10),
    frequency: def.frequency,
    toleranceMs: def.freshnessMs,
    evaluatedAt: asOf,
  });
  const calendar = series.calendar;
  if (!calendar) return "UNKNOWN";
  return qualityFromMarketHours({
    observedAt: item.observedAt,
    evaluatedAt: asOf,
    maxAgeMs: freshnessPolicyForFamily("MARKET_REALTIME").maxAgeMs,
    calendar,
  });
}

function latestQualified(rows: Observation[], series: Series, asOf: string): Observation | null {
  const matches = rows.filter((row) =>
    row.domain === series.domain &&
    row.sourceId === series.sourceId &&
    (series.sourceId === "fred" || row.subject === series.seriesKey) &&
    (row.metadata?.seriesId === series.seriesKey || row.metadata?.metricId === series.seriesKey) &&
    validAt(row.observedAt, asOf) &&
    validAt(row.retrievedAt, asOf));
  if (matches.length === 0) return null;
  const latest = [...matches].sort((a, b) => compareObservationHistory(b, a))[0];
  return { ...latest, quality: evaluatedQuality(latest, series, asOf) };
}

function latestByIdentity<T extends { id: string; retrievedAt: string }>(
  rows: T[], key: (value: T) => string,
): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const k = key(row);
    const previous = latest.get(k);
    if (!previous || Date.parse(row.retrievedAt) > Date.parse(previous.retrievedAt)) latest.set(k, row);
  }
  return [...latest.values()];
}

function newsFromEvidence(row: Evidence): NewsItem | null {
  if (row.kind !== "NEWS" || !row.publishedAt || !row.metadata) return null;
  const url = row.metadata.url;
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return null;
  return {
    id: row.id,
    category: typeof row.metadata.category === "string" ? row.metadata.category : "News",
    source: typeof row.metadata.source === "string" ? row.metadata.source : row.sourceId,
    publishedAt: row.publishedAt,
    title: row.subject,
    summary: row.content,
    url,
  };
}

function calendarFromEvent(item: Event, asOf: Date): CalendarEvent | null {
  if (item.sourceId !== "forex-factory" || !item.scheduledAt) return null;
  const scheduled = new Date(item.scheduledAt);
  if (!Number.isFinite(scheduled.getTime())) return null;
  const jakarta = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(scheduled);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(asOf);
  const eventDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(scheduled);
  const country = item.jurisdiction ?? "OTHER";
  return {
    id: item.id, time: jakarta, event: item.subject, country,
    impact: item.importance,
    status: eventDay === today ? "TODAY" : (scheduled.getTime() < asOf.getTime() ? "PAST" : "UPCOMING"),
    dateISO: item.scheduledAt,
  };
}

function providerHealth(
  sourceId: string,
  rows: Array<Observation | Event | Evidence>,
  failures: Set<string>,
): ProviderHealth {
  const sorted = [...rows].sort((a, b) => Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt));
  const latest = sorted[0];
  const freshest = rows.some((row) => "quality" in row && row.quality === "FRESH");
  return {
    sourceId,
    status: failures.has(sourceId) ? "ERROR" : !latest ? "EMPTY" : freshest || !rows.some((row) => "quality" in row) ? "HEALTHY" : "STALE",
    // Reflect last durable acquisition, never claim the dashboard itself fetched a provider.
    fetchedAt: latest?.retrievedAt ?? "",
    itemCount: rows.length,
    ...(!latest ? { message: "Tidak ada data durabel yang memenuhi batas waktu pembacaan." } : {}),
  };
}

export async function readDurableDashboardData(
  asOf: Date,
  repositories: DurableDashboardRepositories,
): Promise<NormalizedDashboardData> {
  if (!Number.isFinite(asOf.getTime())) throw new Error("Dashboard requires a valid as-of cutoff");
  const cutoff = asOf.toISOString();
  const failures = new Set<string>();
  const yahooSeriesFailures = new Set<string>();

  const observationResults = await Promise.all(SERIES.map(async (series) => {
    try {
      const rows = await repositories.observations.findHistory({
        identity: { domain: series.domain, seriesKey: series.seriesKey },
        sourceId: series.sourceId,
        observedAtOnOrBefore: cutoff, retrievedAtOnOrBefore: cutoff,
        order: "DESC", limit: 8,
      });
      return latestQualified(rows, series, cutoff);
    } catch {
      if (series.sourceId === "yahoo-finance") yahooSeriesFailures.add(series.seriesKey);
      else failures.add(series.sourceId);
      return null;
    }
  }));
  const observations = observationResults.filter((row): row is Observation => row !== null);
  const macroObservations = observations.filter((row) => row.domain === "MACRO");

  const evidenceResults = await Promise.all(NEWS_SOURCES.map(async (sourceId) => {
    try {
      return await repositories.evidence.findHistory({
        sourceId, kind: "NEWS",
        retrievedAtOnOrBefore: cutoff, order: "DESC", limit: 20,
      });
    } catch {
      failures.add(sourceId);
      return [] as Evidence[];
    }
  }));
  const newsEvidence = latestByIdentity(
    evidenceResults.flat().filter((item) => validAt(item.retrievedAt, cutoff)),
    (row) => row.id,
  );
  const items = newsEvidence.map(newsFromEvidence).filter((row): row is NewsItem => row !== null)
    .filter((row) => validAt(row.publishedAt, cutoff))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const cryptoCategory = (row: Evidence) => /\b(CRYPTO|BLOCKCHAIN|DIGITAL CURRENCY)\b/i.test(
    String(row.metadata?.category ?? ""));
  const macroNews = items.filter((item) => newsEvidence.some((e) => e.id === item.id &&
    e.sourceId === "alpha-vantage" && !cryptoCategory(e))).slice(0, 6);
  const cryptoNews = items.filter((item) => newsEvidence.some((e) => e.id === item.id &&
    (e.sourceId === "coindesk-rss" || (e.sourceId === "alpha-vantage" && cryptoCategory(e))))).slice(0, 6);

  let events: Event[] = [];
  try {
    const rows = await repositories.events.findHistory({
      scheduledAtOnOrAfter: new Date(asOf.getTime() - 48 * 60 * 60_000).toISOString(),
      scheduledAtOnOrBefore: new Date(asOf.getTime() + 7 * 24 * 60 * 60_000).toISOString(),
      retrievedAtOnOrBefore: cutoff, order: "ASC", limit: 200,
    });
    events = latestByIdentity(rows.filter((item) => validAt(item.retrievedAt, cutoff)),
      (item) => item.identity?.key ?? item.id);
  } catch {
    failures.add("forex-factory");
    failures.add("federal-reserve");
    failures.add("biquote");
  }
  const calendarEvents = events.map((item) => calendarFromEvent(item, asOf))
    .filter((row): row is CalendarEvent => row !== null)
    .sort((a, b) => Date.parse(a.dateISO) - Date.parse(b.dateISO)).slice(0, 6);

  const all: Array<Observation | Event | Evidence> = [...observations, ...events, ...newsEvidence];
  const yahooSeriesHealth: YahooSeriesHealth[] = YAHOO_MARKET_SERIES.map(({ seriesKey }) => ({
    ...providerHealth(
      "yahoo-finance",
      observations.filter((row) => row.sourceId === "yahoo-finance"
        && (row.metadata?.metricId === seriesKey || row.metadata?.seriesId === seriesKey)),
      new Set(yahooSeriesFailures.has(seriesKey) ? ["yahoo-finance"] : []),
    ),
    seriesKey,
  }));
  const yahooMarketHealth = aggregateYahooHealth(yahooSeriesHealth);
  const providerHealthRows = PROVIDERS.map((sourceId) =>
    sourceId === "yahoo-finance"
      ? yahooMarketHealth
      : providerHealth(sourceId, all.filter((row) => row.sourceId === sourceId), failures));
  const unavailableSources = [
    ...providerHealthRows.filter((row) =>
      row.sourceId !== "yahoo-finance" && row.status !== "HEALTHY")
      .map((row) => `${row.sourceId}: ${row.status === "ERROR" ? "gagal membaca histori" :
        row.status === "STALE" ? "data terakhir sudah lama" : "belum ada data durabel"}`),
    ...yahooSeriesUnavailable(yahooSeriesHealth),
  ];

  return {
    macroNews, cryptoNews, calendarEvents,
    calendarProviderMessage: "Kalender dari histori tersimpan; cakupan event dapat tidak lengkap.",
    unavailableSources,
    observations, macroObservations, events,
    economicEventResults: [], // no broad, qualified EventResult-history query; never synthesize a consensus
    contexts: buildDashboardContexts({ observations, events, createdAt: cutoff }),
    evidence: newsEvidence,
    providerHealth: providerHealthRows,
    yahooSeriesHealth,
  };
}

