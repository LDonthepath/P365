import type { CalendarEvent, NewsItem, ProviderResult } from "../data/types";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DataQuality, Evidence, Event, Observation, ProviderHealth, SourceHealthStatus } from "./types";

export const P365_SOURCES = {
  alphaVantage: { id: "alpha-vantage", name: "Alpha Vantage", type: "NEWS" },
  alphaVantageMarket: { id: "alpha-vantage-market", name: "Alpha Vantage Market", type: "MARKET" },
  coinDesk: { id: "coindesk", name: "CoinDesk", type: "NEWS" },
  fmp: { id: "financial-modeling-prep", name: "Financial Modeling Prep", type: "CALENDAR" },
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

export function newsToEvidence(items: NewsItem[], sourceId: string): Evidence[] {
  return items.map((item) => ({
    id: hashId("evidence", `${sourceId}:${item.id}`),
    sourceId,
    kind: "NEWS",
    subject: item.title,
    content: item.summary,
    capturedAt: item.publishedAt,
    metadata: { category: item.category, url: item.url, source: item.source },
  }));
}

export function calendarToCanonicalRecords(items: CalendarEvent[], sourceId: string): {
  events: Event[];
  evidence: Evidence[];
} {
  const evidence = items.map((item) => ({
    id: hashId("evidence", `${sourceId}:${item.id}`),
    sourceId,
    kind: "EVENT" as const,
    subject: item.event,
    content: `${item.country} · ${item.impact} impact · ${item.status}`,
    capturedAt: new Date().toISOString(),
    metadata: { country: item.country, impact: item.impact, status: item.status, scheduledAt: item.dateISO },
  }));

  const events = items.map((item, index) => {
    const scheduledAt = new Date(item.dateISO).toISOString();
    return {
      id: hashId("event", `${sourceId}:${item.id}`),
      subject: item.event,
      description: `${item.country} economic event`,
      scheduledAt,
      status: item.status === "PAST" ? "PAST" as const : "UPCOMING" as const,
      importance: item.impact,
      sourceId,
      evidenceId: evidence[index].id,
    };
  });

  return { events, evidence };
}

export function cryptoMarketToObservations(items: CryptoMarketObservationInput[], sourceId: string): {
  observations: Observation[];
  evidence: Evidence[];
} {
  const evidence = items.map((item) => ({
    id: hashId("evidence", `${sourceId}:${item.symbol}:${item.observedAt}`),
    sourceId,
    kind: "OBSERVATION" as const,
    subject: `${item.symbol}/USD spot rate`,
    content: `${item.symbol}/USD observed at ${item.value}`,
    capturedAt: item.observedAt,
    metadata: item.metadata,
  }));

  const observations = items.map((item, index) => observationFromCanonicalFact({
    id: hashId("observation", `${sourceId}:${item.symbol}:${item.observedAt}`),
    domain: "ASSET",
    subject: `${item.symbol}/USD spot rate`,
    value: String(item.value),
    observedAt: item.observedAt,
    sourceId,
    evidenceId: evidence[index].id,
    metadata: { symbol: item.symbol, quote: "USD", ...item.metadata },
  }));

  return { observations, evidence };
}

export function observationFromCanonicalFact(input: {
  id: string;
  domain: "MARKET" | "MACRO" | "ASSET" | "OTHER";
  subject: string;
  value: string;
  observedAt: string;
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
