import type { CalendarEvent, NewsItem, ProviderResult } from "../data/types";
import type { DataQuality, Evidence, Event, ProviderHealth, SourceHealthStatus } from "./types";

export const P365_SOURCES = {
  alphaVantage: { id: "alpha-vantage", name: "Alpha Vantage", type: "NEWS" },
  coinDesk: { id: "coindesk", name: "CoinDesk", type: "NEWS" },
  fmp: { id: "financial-modeling-prep", name: "Financial Modeling Prep", type: "CALENDAR" },
} as const;

function hashId(prefix: string, value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

function observationQuality(observedAt: string): DataQuality {
  return Number.isFinite(new Date(observedAt).getTime()) ? "FRESH" : "UNKNOWN";
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

export function calendarToEvents(items: CalendarEvent[], sourceId: string): Event[] {
  return items.map((item) => {
    const scheduledAt = new Date(item.dateISO).toISOString();
    const evidenceId = hashId("evidence", `${sourceId}:${item.id}`);
    return {
      id: hashId("event", `${sourceId}:${item.id}`),
      subject: item.event,
      description: `${item.country} economic event`,
      scheduledAt,
      status: item.status === "PAST" ? "PAST" : "UPCOMING",
      importance: item.impact,
      sourceId,
      evidenceId,
    };
  });
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
}): import("./types").Observation {
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
