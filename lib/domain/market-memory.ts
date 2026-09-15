import type { Evidence, Event, Observation, State } from "./types";

export type MarketMemoryRecordType = "OBSERVATION" | "EVENT" | "STATE" | "EVIDENCE";

export type MarketMemoryRecord = {
  id: string;
  type: MarketMemoryRecordType;
  recordedAt: string;
  effectiveAt: string;
  sourceId: string;
  canonicalId: string;
  payloadHash?: string;
};

export type MarketMemoryAppendInput = {
  observation?: Observation;
  event?: Event;
  state?: State;
  evidence?: Evidence;
};

export type MarketMemoryStore = {
  append(input: MarketMemoryAppendInput): Promise<MarketMemoryRecord>;
  appendMany(input: MarketMemoryAppendInput[]): Promise<MarketMemoryRecord[]>;
  findByCanonicalId(canonicalId: string): Promise<MarketMemoryRecord[]>;
};

function recordFromInput(input: MarketMemoryAppendInput): MarketMemoryRecord {
  const entries = [
    input.observation && { type: "OBSERVATION" as const, item: input.observation, effectiveAt: input.observation.observedAt, sourceId: input.observation.sourceId },
    input.event && { type: "EVENT" as const, item: input.event, effectiveAt: input.event.occurredAt ?? input.event.scheduledAt ?? input.event.status, sourceId: input.event.sourceId },
    input.state && { type: "STATE" as const, item: input.state, effectiveAt: input.state.evaluatedAt, sourceId: input.state.domain },
    input.evidence && { type: "EVIDENCE" as const, item: input.evidence, effectiveAt: input.evidence.capturedAt, sourceId: input.evidence.sourceId },
  ].filter(Boolean) as Array<{ type: MarketMemoryRecordType; item: { id: string }; effectiveAt: string; sourceId: string }>;

  if (entries.length !== 1) throw new Error("Market Memory append requires exactly one canonical object.");

  const entry = entries[0];
  return {
    id: `memory-${entry.type.toLowerCase()}-${entry.item.id}-${entry.effectiveAt}`,
    type: entry.type,
    recordedAt: new Date().toISOString(),
    effectiveAt: entry.effectiveAt,
    sourceId: entry.sourceId,
    canonicalId: entry.item.id,
  };
}

/**
 * Contract-only adapter. It intentionally does not pretend to be durable.
 * Production persistence must be supplied by an external append-only store.
 */
export class NonDurableMarketMemoryStore implements MarketMemoryStore {
  private readonly records: MarketMemoryRecord[] = [];

  async append(input: MarketMemoryAppendInput): Promise<MarketMemoryRecord> {
    const record = recordFromInput(input);
    this.records.push(record);
    return record;
  }

  async appendMany(input: MarketMemoryAppendInput[]): Promise<MarketMemoryRecord[]> {
    const records = input.map(recordFromInput);
    this.records.push(...records);
    return records;
  }

  async findByCanonicalId(canonicalId: string): Promise<MarketMemoryRecord[]> {
    return this.records.filter((record) => record.canonicalId === canonicalId);
  }
}

export function assertAppendOnlyMemory(records: MarketMemoryRecord[]): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Duplicate Market Memory record: ${record.id}`);
    ids.add(record.id);
    if (!record.canonicalId || !record.recordedAt || !record.effectiveAt) {
      throw new Error(`Invalid Market Memory record: ${record.id}`);
    }
  }
}
