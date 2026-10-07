import { createHash } from "node:crypto";
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
    const observationEffectiveAt = evidence.kind === "OBSERVATION"
      && typeof evidence.metadata?.observationEffectiveAt === "string"
      ? evidence.metadata.observationEffectiveAt
      : undefined;
    return observationEffectiveAt ?? evidence.publishedAt ?? evidence.releasedAt ?? evidence.retrievedAt;
  }
  if (recordType === "SNAPSHOT") return (record as MarketSnapshot).capturedAt;
  return (record as Context).createdAt;
}

function eventEvidenceSemanticFingerprint(evidence: Evidence): string {
  const canonical = JSON.stringify([
    evidence.sourceId,
    evidence.kind,
    evidence.subject,
    evidence.content,
    evidence.publishedAt ?? null,
    evidence.releasedAt ?? null,
    Object.entries(evidence.metadata ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function marketMemoryDedupeKey(
  recordType: MarketMemoryRecordType,
  record: CanonicalRecord,
): string {
  if (recordType === "EVIDENCE" && (record as Evidence).kind === "EVENT") {
    const evidence = record as Evidence;
    // EVIDENCE-EFF-001C: retrieval/capture time is availability, not a factual
    // Event Evidence version. Keep one physical row for identical semantic
    // content, while changed provider content remains append-only.
    return `${recordType}:${record.id}:semantic-v1:${eventEvidenceSemanticFingerprint(evidence)}`;
  }

  const effectiveAt = marketMemoryEffectiveAt(recordType, record);
  // FND-018A Observation IDs already encode a normalized measurement instant;
  // normalize the key timestamp too so equivalent date/offset serialization
  // cannot defeat factual-version idempotency. Other record families retain
  // their legacy contract and stay outside this checkpoint.
  const dedupeEffectiveAt = recordType === "OBSERVATION"
    || (recordType === "EVIDENCE" && (record as Evidence).kind === "OBSERVATION")
    ? new Date(effectiveAt).toISOString()
    : effectiveAt;
  return `${recordType}:${record.id}:${dedupeEffectiveAt}`;
}
