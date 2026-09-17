import type { CalendarEvent, NewsItem, ProviderResult } from "../data/types";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import type { FomcEventInput } from "../data/federal-reserve-events";
import type { DataQuality, Evidence, Event, Observation, ProviderHealth, SourceHealthStatus } from "./types";

export const P365_SOURCES = {
  alphaVantage: { id: "alpha-vantage", name: "Alpha Vantage", type: "NEWS" },
  alphaVantageMarkets: { id: "alpha-vantage-markets", name: "Alpha Vantage (Gold & Russell 2000)", type: "MARKET" },
  coinGeckoMarket: { id: "coingecko-market", name: "CoinGecko Market", type: "MARKET" },
  coinDesk: { id: "coindesk", name: "CoinDesk", type: "NEWS" },
  forexFactory: { id: "forex-factory", name: "Forex Factory", type: "CALENDAR" },
  fred: { id: "fred", name: "Federal Reserve Economic Data (FRED)", type: "MACRO" },
  federalReserve: { id: "federal-reserve", name: "Board of Governors of the Federal Reserve System", type: "CALENDAR" },
} as const;

function hashId(prefix: string, value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

function observationQuality(observedAt: string): DataQuality {
  const observedAtMs = new Date(observedAt).getTime();
  if (!Number.isFinite(observedAtMs) || observedAtMs > Date.now()) return "UNKNOWN";
  return Date.now() - observedAtMs <= 15 * 60_000 ? "FRESH" : "STALE";
}

function macroObservationQuality(observationDate: string, freshnessMs: number): DataQuality {
  const observationDateMs = new Date(`${observationDate}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(observationDateMs) || observationDateMs > Date.now()) return "UNKNOWN";
  return Date.now() - observationDateMs <= freshnessMs ? "FRESH" : "STALE";
}

function isValidCurrentOrPastMacroDate(observationDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observationDate)) return false;
  const date = new Date(`${observationDate}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === observationDate
    && observationDate <= new Date().toISOString().slice(0, 10);
}

export function newsToEvidence(items: NewsItem[], sourceId: string): Evidence[] {
  const retrievedAt = new Date().toISOString();
  return items.map((item) => ({
    id: hashId("evidence", `${sourceId}:${item.id}`),
    sourceId,
    kind: "NEWS",
    subject: item.title,
    content: item.summary,
    capturedAt: retrievedAt,
    retrievedAt,
    publishedAt: item.publishedAt,
    metadata: { category: item.category, url: item.url, source: item.source },
  }));
}

export function calendarToCanonicalRecords(items: CalendarEvent[], sourceId: string): { events: Event[]; evidence: Evidence[] } {
  const retrievedAt = new Date().toISOString();
  const evidence = items.map((item) => ({
    id: hashId("evidence", `${sourceId}:${item.id}`),
    sourceId,
    kind: "EVENT" as const,
    subject: item.event,
    content: `${item.country} · ${item.impact} impact · ${item.status}`,
    capturedAt: retrievedAt,
    retrievedAt,
    metadata: { country: item.country, impact: item.impact, status: item.status, scheduledAt: item.dateISO },
  }));

  const events = items.map((item, index) => ({
    id: hashId("event", `${sourceId}:${item.id}`),
    subject: item.event,
    description: `${item.country} economic event`,
    scheduledAt: new Date(item.dateISO).toISOString(),
    retrievedAt,
    status: item.status === "PAST" ? "PAST" as const : "UPCOMING" as const,
    importance: item.impact,
    sourceId,
    evidenceId: evidence[index].id,
  }));

  return { events, evidence };
}

export function cryptoMarketToObservations(items: CryptoMarketObservationInput[], sourceId: string): { observations: Observation[]; evidence: Evidence[] } {
  const evidence = items.map((item) => ({
    id: hashId("evidence", `${sourceId}:${item.metricId}:${item.observedAt}`),
    sourceId,
    kind: "OBSERVATION" as const,
    subject: item.metricId,
    content: `${item.metricId} observed at ${item.value}`,
    capturedAt: item.retrievedAt,
    retrievedAt: item.retrievedAt,
    metadata: { ...item.metadata, symbol: item.symbol, metricId: item.metricId },
  }));

  const observations = items.map((item, index) => observationFromCanonicalFact({
    id: hashId("observation", `${sourceId}:${item.metricId}:${item.observedAt}`),
    domain: item.metricId.startsWith("crypto.") ? "MARKET" : "ASSET",
    subject: item.metricId,
    value: String(item.value),
    observedAt: item.observedAt,
    retrievedAt: item.retrievedAt,
    sourceId,
    evidenceId: evidence[index].id,
    metadata: { symbol: item.symbol, metricId: item.metricId, ...item.metadata },
  }));

  return { observations, evidence };
}

/** Converts validated FRED records into canonical facts without interpretation. */
export function macroToCanonicalRecords(items: MacroObservationInput[], sourceId: string): { observations: Observation[]; evidence: Evidence[] } {
  const eligibleItems = items.filter((item) => isValidCurrentOrPastMacroDate(item.observationDate));
  const evidence = eligibleItems.map((item) => ({
    id: hashId("evidence", `${sourceId}:${item.series.seriesId}:${item.observationDate}:${item.value}`),
    sourceId,
    kind: "OBSERVATION" as const,
    subject: item.series.subject,
    content: `${item.series.seriesId} = ${item.value} (${item.observationDate})`,
    capturedAt: item.retrievedAt,
    retrievedAt: item.retrievedAt,
    metadata: {
      seriesId: item.series.seriesId,
      frequency: item.series.frequency,
      unit: item.series.unit,
      source: item.series.source,
      observationDate: item.observationDate,
      releaseDate: null,
      previousValue: item.previousValue,
      vintageDate: item.vintageDate,
    },
  }));

  const observations = eligibleItems.map((item, index) => ({
    id: hashId("observation", `${sourceId}:${item.series.seriesId}:${item.observationDate}:${item.value}`),
    domain: item.series.domain,
    subject: item.series.subject,
    value: item.value,
    observedAt: item.observationDate,
    retrievedAt: item.retrievedAt,
    sourceId,
    quality: macroObservationQuality(item.observationDate, item.series.freshnessMs),
    evidenceId: evidence[index].id,
    metadata: {
      seriesId: item.series.seriesId,
      frequency: item.series.frequency,
      unit: item.series.unit,
      source: item.series.source,
      observationDate: item.observationDate,
      releaseDate: null,
      previousValue: item.previousValue,
      vintageDate: item.vintageDate,
    },
  }));

  return { observations, evidence };
}

export function fomcToCanonicalRecords(items: FomcEventInput[], sourceId: string): { events: Event[]; evidence: Evidence[] } {
  const retrievedAt = new Date().toISOString();
  const evidence = items.map((item) => ({
    id: hashId("evidence", `${sourceId}:fomc:${item.scheduledAt}`),
    sourceId,
    kind: "EVENT" as const,
    subject: "FOMC meeting",
    content: `FOMC meeting scheduled for ${item.label}`,
    capturedAt: retrievedAt,
    retrievedAt,
    metadata: { source: "Federal Reserve", scheduledAt: item.scheduledAt, scheduledAtIsDateAnchor: true, url: item.sourceUrl },
  }));
  const events = items.map((item, index) => ({
    id: hashId("event", `${sourceId}:fomc:${item.scheduledAt}`),
    subject: "FOMC meeting",
    description: `Federal Open Market Committee meeting (${item.label})`,
    scheduledAt: item.scheduledAt,
    retrievedAt,
    status: "UPCOMING" as const,
    importance: "HIGH" as const,
    sourceId,
    evidenceId: evidence[index].id,
  }));
  return { events, evidence };
}

export function observationFromCanonicalFact(input: {
  id: string;
  domain: "MARKET" | "MACRO" | "ASSET" | "OTHER";
  subject: string;
  value: string;
  observedAt: string;
  retrievedAt: string;
  sourceId: string;
  evidenceId: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Observation {
  return {
    ...input,
    quality: observationQuality(input.observedAt),
  };
}

export function providerHealthForResult<T>(sourceId: string, result: ProviderResult<T>): ProviderHealth {
  const status: SourceHealthStatus = result.status === "SUCCESS" ? "HEALTHY" : result.status;
  return {
    sourceId,
    status,
    fetchedAt: new Date().toISOString(),
    itemCount: result.data.length,
    message: result.message,
  };
}
