import "server-only";
import type { EconomicEventResult } from "../domain/event-result";
import type { Evidence, Event } from "../domain/types";
import type { ProviderResult } from "./types";
import { providerResult } from "./types";

const BIQUOTE_CALENDAR_URL = "https://biquote.io/api/calendar";

export type BiquoteEconomicCalendarRecord = {
  id: string;
  eventId: string;
  time: string;
  period?: string | null;
  countryCode: string;
  currency?: string | null;
  name: string;
  importance: string;
  type: string;
  unit?: string | null;
  multiplier?: string | null;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  revisedPrevious?: number | null;
  revision?: number | null;
  timeMode?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
};

export type BiquoteEconomicCalendarCanonical = {
  event: Event;
  result: EconomicEventResult;
  evidence: Evidence;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRecord(value: unknown): BiquoteEconomicCalendarRecord | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.eventId !== "string" ||
    typeof value.time !== "string" ||
    typeof value.countryCode !== "string" ||
    typeof value.name !== "string"
  ) return null;

  const parsedTime = Date.parse(value.time);
  if (!Number.isFinite(parsedTime)) return null;

  const numeric = (key: string): number | null | undefined => {
    const candidate = value[key];
    if (candidate === null || candidate === undefined) return candidate;
    return isFiniteNumber(candidate) ? candidate : undefined;
  };

  return {
    id: value.id,
    eventId: value.eventId,
    time: new Date(parsedTime).toISOString(),
    period: typeof value.period === "string" ? value.period : null,
    countryCode: value.countryCode,
    currency: typeof value.currency === "string" ? value.currency : null,
    name: value.name,
    importance: typeof value.importance === "string" ? value.importance : "low",
    type: typeof value.type === "string" ? value.type : "event",
    unit: typeof value.unit === "string" ? value.unit : null,
    multiplier: typeof value.multiplier === "string" ? value.multiplier : null,
    actual: numeric("actual"),
    forecast: numeric("forecast"),
    previous: numeric("previous"),
    revisedPrevious: numeric("revisedPrevious"),
    revision: numeric("revision"),
    timeMode: typeof value.timeMode === "string" ? value.timeMode : null,
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : null,
    source: typeof value.source === "string" ? value.source : null,
  };
}

function mapImportance(value: string): Event["importance"] {
  const normalized = value.toUpperCase();
  if (normalized === "HIGH") return "HIGH";
  if (normalized === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function mapStatus(record: BiquoteEconomicCalendarRecord, now: Date): Event["status"] {
  if (record.actual !== null && record.actual !== undefined) return "PAST";
  return Date.parse(record.time) > now.getTime() ? "UPCOMING" : "ACTIVE";
}

export function normalizeBiquoteEconomicCalendar(
  records: BiquoteEconomicCalendarRecord[],
  retrievedAt: string,
): BiquoteEconomicCalendarCanonical[] {
  return records.map((record) => {
    const evidenceId = `biquote-economic-event-evidence-${record.id}`;
    const eventId = `biquote-economic-event-${record.id}`;
    const hasActual = record.actual !== null && record.actual !== undefined;
    const evidence: Evidence = {
      id: evidenceId,
      sourceId: "biquote",
      kind: "EVENT",
      subject: record.name,
      content: JSON.stringify({
        providerEventId: record.eventId,
        actual: record.actual ?? null,
        forecast: record.forecast ?? null,
        previous: record.previous ?? null,
        revisedPrevious: record.revisedPrevious ?? null,
        revision: record.revision ?? null,
        unit: record.unit ?? null,
        period: record.period ?? null,
        sourceUrl: record.sourceUrl ?? null,
      }),
      retrievedAt,
      ...(hasActual ? { releasedAt: record.time } : {}),
      metadata: {
        providerEventId: record.eventId,
        countryCode: record.countryCode,
        currency: record.currency ?? null,
        type: record.type,
        multiplier: record.multiplier ?? null,
        timeMode: record.timeMode ?? null,
        sourceUrl: record.sourceUrl ?? null,
      },
    };

    const event: Event = {
      id: eventId,
      subject: record.name,
      description: `${record.countryCode} ${record.name}`,
      scheduledAt: record.time,
      ...(hasActual ? { occurredAt: record.time, releasedAt: record.time } : {}),
      retrievedAt,
      status: mapStatus(record, new Date(retrievedAt)),
      importance: mapImportance(record.importance),
      sourceId: "biquote",
      evidenceId,
    };

    const result: EconomicEventResult = {
      eventId,
      ...(isFiniteNumber(record.actual) ? { actual: record.actual } : {}),
      ...(isFiniteNumber(record.forecast)
        ? { expected: record.forecast, expectedType: "FORECAST" as const }
        : {}),
      ...(isFiniteNumber(record.previous) ? { previous: record.previous } : {}),
      ...(isFiniteNumber(record.revisedPrevious)
        ? { revisedPrevious: record.revisedPrevious }
        : {}),
      ...(isFiniteNumber(record.revision) ? { revision: record.revision } : {}),
      ...(record.unit ? { unit: record.unit } : {}),
      ...(record.period ? { period: record.period } : {}),
      ...(hasActual ? { releasedAt: record.time } : {}),
      retrievedAt,
      sourceId: "biquote",
      evidenceId,
    };

    return { event, result, evidence };
  });
}

export async function fetchBiquoteEconomicCalendar(options: {
  from?: string;
  to?: string;
  countries?: string[];
  importance?: "low" | "medium" | "high";
  limit?: number;
} = {}): Promise<ProviderResult<BiquoteEconomicCalendarRecord>> {
  const params = new URLSearchParams();
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.countries?.length) params.set("countries", options.countries.join(","));
  if (options.importance) params.set("importance", options.importance);
  if (options.limit !== undefined) params.set("limit", String(options.limit));

  const retrievedAt = new Date().toISOString();

  try {
    const response = await fetch(`${BIQUOTE_CALENDAR_URL}?${params.toString()}`, {
      next: { revalidate: 3600, tags: ["p365-dashboard"] },
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });

    const body = await response.text();
    if (!response.ok) {
      return providerResult("biquote", "ERROR", [], `Biquote HTTP ${response.status}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return providerResult("biquote", "ERROR", [], "Biquote returned invalid JSON");
    }

    if (!Array.isArray(parsed)) {
      return providerResult("biquote", "ERROR", [], "Biquote calendar returned a non-array response");
    }

    const records = parsed.flatMap((item) => {
      const record = parseRecord(item);
      return record ? [record] : [];
    });

    if (parsed.length > 0 && records.length === 0) {
      return providerResult("biquote", "ERROR", [], "Biquote calendar contained no valid event records");
    }

    return providerResult(
      "biquote",
      records.length > 0 ? "SUCCESS" : "EMPTY",
      records,
      records.length > 0 ? undefined : "Biquote calendar returned no matching events",
    );
  } catch (error) {
    return providerResult("biquote", "ERROR", [], error instanceof Error ? error.message : "Biquote request failed");
  }
}
