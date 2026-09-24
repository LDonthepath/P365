import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Context, Event, Evidence, Observation } from "../domain/types";

export type CanonicalRecord = Observation | Event | Evidence | Context | MarketSnapshot;
export type MarketMemoryRecordType = "OBSERVATION" | "EVENT" | "EVIDENCE" | "CONTEXT" | "SNAPSHOT";

export function marketMemoryEffectiveAt(
  recordType: MarketMemoryRecordType,
  record: CanonicalRecord,
): string {
  if (recordType === "OBSERVATION") return (record as Observation).observedAt;
  if (recordType === "EVENT") {
    const event = record as Event;
    return event.occurredAt ?? event.scheduledAt ?? event.retrievedAt;
  }
  if (recordType === "EVIDENCE") {
    const evidence = record as Evidence;
    return evidence.publishedAt ?? evidence.releasedAt ?? evidence.retrievedAt;
  }
  if (recordType === "SNAPSHOT") return (record as MarketSnapshot).capturedAt;
  return (record as Context).createdAt;
}

export function marketMemoryDedupeKey(
  recordType: MarketMemoryRecordType,
  record: CanonicalRecord,
): string {
  const effectiveAt = marketMemoryEffectiveAt(recordType, record);
  // FND-018A Observation IDs already encode a normalized measurement instant;
  // normalize the key timestamp too so equivalent date/offset serialization
  // cannot defeat factual-version idempotency. Other record families retain
  // their legacy contract and stay outside this checkpoint.
  const dedupeEffectiveAt = recordType === "OBSERVATION"
    ? new Date(effectiveAt).toISOString()
    : effectiveAt;
  return `${recordType}:${record.id}:${dedupeEffectiveAt}`;
}
