import { createHash } from "node:crypto";
import type { BiquoteEconomicCalendarRecord } from "../data/biquote-economic-calendar";
import { biquoteJurisdiction } from "../data/event-jurisdiction";
import type { EconomicEventResult } from "../domain/event-result";
import { buildEventIdentity } from "../domain/event-identity";
import type { Evidence, Event } from "../domain/types";

export type BiquoteEconomicCalendarCanonical = {
  event: Event;
  result: EconomicEventResult;
  evidence: Evidence;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

/** Identical provider snapshots dedupe; changed result content creates a new append-only identity. */
function snapshotFingerprint(record: BiquoteEconomicCalendarRecord): string {
  const canonical = JSON.stringify([
    record.eventId,
    record.time,
    record.period ?? null,
    record.unit ?? null,
    record.multiplier ?? null,
    record.actual ?? null,
    record.forecast ?? null,
    record.previous ?? null,
    record.revisedPrevious ?? null,
    record.revision ?? null,
    record.sourceUrl ?? null,
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function normalizeBiquoteEconomicCalendar(
  records: BiquoteEconomicCalendarRecord[],
  retrievedAt: string,
): BiquoteEconomicCalendarCanonical[] {
  return records.map((record) => {
    const evidenceId = `biquote-economic-event-evidence-${record.id}`;
    const eventId = `biquote-economic-event-${record.id}`;
    const hasActual = record.actual !== null && record.actual !== undefined;
    const hasExactTime = record.timeMode?.toLowerCase() === "exact";
    const hasExactActualTime = hasActual && hasExactTime;
    const identity = hasExactTime
      ? buildEventIdentity({
          subject: record.name,
          jurisdiction: biquoteJurisdiction(record.countryCode),
          scheduledAt: record.time,
        })
      : undefined;
    const resultId = `biquote-economic-event-result-${record.id}-${snapshotFingerprint(record)}`;
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
        source: record.source ?? null,
        sourceUrl: record.sourceUrl ?? null,
      }),
      retrievedAt,
      capturedAt: retrievedAt,
      ...(hasExactActualTime ? { releasedAt: record.time } : {}),
      metadata: {
        providerEventId: record.eventId,
        countryCode: record.countryCode,
        currency: record.currency ?? null,
        type: record.type,
        multiplier: record.multiplier ?? null,
        timeMode: record.timeMode ?? null,
        source: record.source ?? null,
        sourceUrl: record.sourceUrl ?? null,
        eventIdentityKey: identity?.key ?? null,
      },
    };
    const event: Event = {
      id: eventId,
      subject: record.name,
      description: `${record.countryCode} ${record.name}`,
      jurisdiction: biquoteJurisdiction(record.countryCode),
      // All provider time modes remain useful calendar anchors. Only `exact`
      // qualifies the clock component for canonical occurrence/release fields.
      scheduledAt: record.time,
      ...(hasExactActualTime ? { occurredAt: record.time, releasedAt: record.time } : {}),
      retrievedAt,
      status: mapStatus(record, new Date(retrievedAt)),
      importance: mapImportance(record.importance),
      sourceId: "biquote",
      evidenceId,
      ...(identity ? { identity } : {}),
    };
    const result: EconomicEventResult = {
      id: resultId,
      eventId,
      ...(identity ? { eventIdentityKey: identity.key } : {}),
      ...(isFiniteNumber(record.actual) ? { actual: record.actual } : {}),
      ...(isFiniteNumber(record.forecast) ? { expected: record.forecast, expectedType: "FORECAST" as const } : {}),
      ...(isFiniteNumber(record.previous) ? { previous: record.previous } : {}),
      ...(isFiniteNumber(record.revisedPrevious) ? { revisedPrevious: record.revisedPrevious } : {}),
      ...(isFiniteNumber(record.revision) ? { revision: record.revision } : {}),
      ...(record.unit ? { unit: record.unit } : {}),
      ...(record.period ? { period: record.period } : {}),
      ...(hasExactActualTime ? { releasedAt: record.time } : {}),
      retrievedAt,
      sourceId: "biquote",
      evidenceId,
    };
    return { event, result, evidence };
  });
}
