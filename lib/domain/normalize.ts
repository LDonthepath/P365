import type { CalendarEvent, NewsItem, ProviderResult } from "../data/types";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import type { FomcEventInput } from "../data/federal-reserve-events";
import { forexFactoryJurisdiction } from "../data/event-jurisdiction";
import type { DataQuality, Evidence, Event, Observation, ObservationSemantics, ProviderHealth, SourceHealthStatus } from "./types";
import { buildObservationIdentity, observationEvidenceId, observationRevisionId } from "./observation-identity";
import { assertCurrentObservationInvariants } from "./observation-provenance";
import { requireObservationSemantics } from "./observation-semantics";
import { qualityFromFreshness, qualityFromMacroCadence, qualityFromMarketHours, freshnessPolicyForFamily } from "./freshness";
import type { MarketFreshnessCalendar } from "./freshness";

export const P365_SOURCES = {
  alphaVantage: { id: "alpha-vantage", name: "Alpha Vantage", type: "NEWS" },
  yahooFinance: { id: "yahoo-finance", name: "Yahoo Finance (Gold, Russell 2000 & DXY)", type: "MARKET" },
  coinGeckoMarket: { id: "coingecko-market", name: "CoinGecko Market", type: "MARKET" },
  coinDesk: { id: "coindesk", name: "CoinDesk", type: "NEWS" },
  forexFactory: { id: "forex-factory", name: "Forex Factory", type: "CALENDAR" },
  biquote: { id: "biquote", name: "Biquote Economic Calendar", type: "CALENDAR" },
  fred: { id: "fred", name: "Federal Reserve Economic Data (FRED)", type: "MACRO" },
  federalReserve: { id: "federal-reserve", name: "Board of Governors of the Federal Reserve System", type: "CALENDAR" },
} as const;

function hashId(prefix: string, value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

function macroObservationQuality(item: MacroObservationInput): DataQuality {
  return qualityFromMacroCadence({
    observationDate: item.observationDate,
    frequency: item.series.frequency,
    toleranceMs: item.series.freshnessMs,
    evaluatedAt: item.retrievedAt,
  });
}

function isValidMacroObservationContext(observationDate: string, retrievedAt: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observationDate)) return false;
  const date = new Date(`${observationDate}T00:00:00.000Z`);
  const retrieved = new Date(retrievedAt);
  return Number.isFinite(date.getTime())
    && Number.isFinite(retrieved.getTime())
    && date.toISOString().slice(0, 10) === observationDate
    && date.getTime() <= retrieved.getTime();
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
    jurisdiction: forexFactoryJurisdiction(item.country),
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
  const normalized = items.map((item) => {
    const domain = item.metricId.startsWith("crypto.") ? "MARKET" as const : "ASSET" as const;
    const value = String(item.value);
    const metadata = { symbol: item.symbol, metricId: item.metricId, freshnessCalendar: item.freshnessCalendar, ...item.metadata };
    const identity = buildObservationIdentity({
      domain,
      seriesKey: item.metricId,
      observedAt: item.observedAt,
      sourceId,
      value,
      unit: typeof item.metadata.unit === "string" ? item.metadata.unit : null,
    });
    const evidenceId = observationEvidenceId(identity);
    const evidence: Evidence = {
      id: evidenceId,
      sourceId,
      kind: "OBSERVATION",
      subject: item.metricId,
      content: `${item.metricId} observed at ${item.value}`,
      capturedAt: item.retrievedAt,
      retrievedAt: item.retrievedAt,
      metadata,
    };
    const observation = observationFromCanonicalFact({
      id: observationRevisionId(identity),
      domain,
      subject: item.metricId,
      value,
      observedAt: item.observedAt,
      retrievedAt: item.retrievedAt,
      sourceId,
      evidenceId,
      identity,
      provenance: item.provenance,
      // Yahoo Finance's chart meta.regularMarketPrice is a live/delayed quote (not a
      // once-daily close), so gold, Russell 2000, and DXY all qualify as MARKET_REALTIME.
      freshnessFamily: "MARKET_REALTIME",
      marketFreshnessCalendar: item.freshnessCalendar,
      semantics: requireObservationSemantics(item.metricId),
      metadata,
    });
    assertCurrentObservationInvariants(observation);
    return { evidence, observation };
  });

  return {
    observations: normalized.map((item) => item.observation),
    evidence: normalized.map((item) => item.evidence),
  };
}

/** Converts validated FRED records into canonical facts without interpretation. */
export function macroToCanonicalRecords(items: MacroObservationInput[], sourceId: string): { observations: Observation[]; evidence: Evidence[] } {
  const eligibleItems = items.filter((item) => isValidMacroObservationContext(item.observationDate, item.retrievedAt));
  const normalized = eligibleItems.map((item) => {
    const metadata = {
      seriesId: item.series.seriesId,
      frequency: item.series.frequency,
      unit: item.series.unit,
      source: item.series.source,
      observationDate: item.observationDate,
      releasedAt: item.releasedAt,
      previousValue: item.previousValue,
      vintageDate: item.vintageDate,
    };
    const identity = buildObservationIdentity({
      domain: item.series.domain,
      seriesKey: item.series.seriesId,
      observedAt: item.observationDate,
      sourceId,
      value: item.value,
      unit: item.series.unit,
      frequency: item.series.frequency,
    });
    const evidenceId = observationEvidenceId(identity);
    const evidence: Evidence = {
      id: evidenceId,
      sourceId,
      kind: "OBSERVATION",
      subject: item.series.subject,
      content: `${item.series.seriesId} = ${item.value} (${item.observationDate})`,
      capturedAt: item.retrievedAt,
      retrievedAt: item.retrievedAt,
      metadata,
    };
    const observation: Observation = {
      id: observationRevisionId(identity),
      domain: item.series.domain,
      subject: item.series.subject,
      value: item.value,
      observedAt: item.observationDate,
      retrievedAt: item.retrievedAt,
      sourceId,
      quality: macroObservationQuality(item),
      evidenceId,
      identity,
      provenance: item.provenance,
      semantics: requireObservationSemantics(item.series.seriesId),
      metadata,
    };
    assertCurrentObservationInvariants(observation);
    return { evidence, observation };
  });

  return {
    observations: normalized.map((item) => item.observation),
    evidence: normalized.map((item) => item.evidence),
  };
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
    jurisdiction: "US" as const,
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
  identity?: Observation["identity"];
  provenance?: Observation["provenance"];
  semantics?: ObservationSemantics;
  /** Explicit freshness classification is required; domain must not imply provider cadence. */
  freshnessFamily: "FRED_MACRO" | "MARKET_REALTIME" | "MARKET_DAILY";
  marketFreshnessCalendar?: MarketFreshnessCalendar;
  metadata?: Record<string, string | number | boolean | null>;
}): Observation {
  const { freshnessFamily, marketFreshnessCalendar, ...canonicalInput } = input;
  const policy = freshnessPolicyForFamily(freshnessFamily);
  const evaluatedAtMs = Date.parse(input.retrievedAt);
  const quality = freshnessFamily === "MARKET_REALTIME"
    ? marketFreshnessCalendar
      ? qualityFromMarketHours({
          observedAt: input.observedAt,
          evaluatedAt: input.retrievedAt,
          maxAgeMs: policy.maxAgeMs,
          calendar: marketFreshnessCalendar,
        })
      : "UNKNOWN"
    : qualityFromFreshness(input.observedAt, policy, evaluatedAtMs);

  return {
    ...canonicalInput,
    quality,
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
