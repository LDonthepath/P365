import type { CalendarEvent, NewsItem } from "../data/types";
import type { DataQuality, Event, Observation, ProviderHealth, Source, SourceHealthStatus } from "./types";

export const P365_SOURCES = {
  alphaVantage: { id: "alpha-vantage", name: "Alpha Vantage", type: "NEWS" },
  coinDesk: { id: "coindesk", name: "CoinDesk", type: "NEWS" },
  fmp: { id: "financial-modeling-prep", name: "Financial Modeling Prep", type: "CALENDAR" },
} as const;

export function sourceDefinition(source: Source): Source {
  return source;
}

function hashId(prefix: string, value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

function newsQuality(publishedAt: string): DataQuality {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  return Number.isFinite(ageMs) && ageMs > 24 * 60 * 60 * 1000 ? "STALE" : "FRESH";
}

export function newsToObservations(items: NewsItem[], sourceId: string, domain: "MACRO" | "NEWS" = "NEWS"): Observation[] {
  return items.map((item) => {
    const evidenceId = hashId("evidence", `${sourceId}:${item.id}`);
    return {
      id: hashId("observation", `${sourceId}:${item.id}`),
      domain,
      subject: item.title,
      value: item.summary,
      observedAt: item.publishedAt,
      sourceId,
      quality: newsQuality(item.publishedAt),
      evidenceId,
      metadata: {
        category: item.category,
        url: item.url,
        source: item.source,
      },
    };
  });
}

export function calendarToEvents(items: CalendarEvent[], sourceId: string): Event[] {
  return items.map((item) => {
    const occurredAt = new Date(`${item.dateISO}T${item.time}:00+07:00`).toISOString();
    const status: Event["status"] = item.status === "PAST" ? "PAST" : item.status === "TODAY" ? "ACTIVE" : "UPCOMING";
    const evidenceId = hashId("evidence", `${sourceId}:${item.id}`);
    return {
      id: hashId("event", `${sourceId}:${item.id}`),
      subject: item.event,
      description: `${item.country} economic event`,
      occurredAt,
      scheduledAt: occurredAt,
      status,
      importance: item.impact,
      sourceId,
      evidenceId,
    };
  });
}

export function providerHealth(sourceId: string, items: unknown[], status: SourceHealthStatus = items.length > 0 ? "HEALTHY" : "EMPTY", message?: string): ProviderHealth {
  return {
    sourceId,
    status,
    fetchedAt: new Date().toISOString(),
    itemCount: items.length,
    message,
  };
}
