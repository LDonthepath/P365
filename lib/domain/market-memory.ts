import "server-only";
import type { Evidence, Event, Observation, State } from "./types";

export type MarketMemoryRecordType = "OBSERVATION" | "EVENT" | "EVIDENCE" | "STATE";

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

type Entry = {
  type: MarketMemoryRecordType;
  item: { id: string };
  effectiveAt: string;
  sourceId: string;
};

function entryFromInput(input: MarketMemoryAppendInput): Entry {
  const entries = [
    input.observation && { type: "OBSERVATION" as const, item: input.observation, effectiveAt: input.observation.observedAt, sourceId: input.observation.sourceId },
    input.event && { type: "EVENT" as const, item: input.event, effectiveAt: input.event.occurredAt ?? input.event.scheduledAt ?? new Date().toISOString(), sourceId: input.event.sourceId },
    input.state && { type: "STATE" as const, item: input.state, effectiveAt: input.state.evaluatedAt, sourceId: input.state.domain },
    input.evidence && { type: "EVIDENCE" as const, item: input.evidence, effectiveAt: input.evidence.capturedAt, sourceId: input.evidence.sourceId },
  ].filter(Boolean) as Entry[];

  if (entries.length !== 1) throw new Error("Market Memory append requires exactly one canonical object.");
  return entries[0];
}

function buildRecord(entry: Entry, row?: { id: string; created_at: string }): MarketMemoryRecord {
  return {
    id: row?.id ?? `memory-${entry.type.toLowerCase()}-${entry.item.id}-${entry.effectiveAt}`,
    type: entry.type,
    recordedAt: row?.created_at ?? new Date().toISOString(),
    effectiveAt: entry.effectiveAt,
    sourceId: entry.sourceId,
    canonicalId: entry.item.id,
  };
}

function getSupabaseConfig(): { url: string; secretKey: string } {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured for durable Market Memory.");
  }
  return { url: url.replace(/\/$/, ""), secretKey };
}

function dedupeKey(entry: Entry): string {
  return `${entry.type}:${entry.item.id}:${entry.effectiveAt}`;
}

async function supabaseRequest<T>(path: string, init: RequestInit): Promise<T> {
  const { url, secretKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase Market Memory request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return (await response.json()) as T;
}

export class SupabaseMarketMemoryStore implements MarketMemoryStore {
  async append(input: MarketMemoryAppendInput): Promise<MarketMemoryRecord> {
    const [record] = await this.appendMany([input]);
    return record;
  }

  async appendMany(inputs: MarketMemoryAppendInput[]): Promise<MarketMemoryRecord[]> {
    if (inputs.length === 0) return [];

    const entries = inputs.map(entryFromInput);
    const rows = entries.map((entry) => ({
      record_type: entry.type,
      canonical_id: entry.item.id,
      source_id: entry.sourceId,
      captured_at: new Date().toISOString(),
      effective_at: entry.effectiveAt,
      dedupe_key: dedupeKey(entry),
      payload: entry.item,
    }));

    const inserted = await supabaseRequest<Array<{ id: string; created_at: string; canonical_id: string }>>(
      "market_memory?on_conflict=dedupe_key",
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(rows),
      },
    );

    if (inserted.length === rows.length) {
      return entries.map((entry, index) => buildRecord(entry, inserted[index]));
    }

    const keys = entries.map(dedupeKey);
    const query = keys.map((key) => `"${key.replace(/"/g, "\\\"")}"`).join(",");
    const existing = await supabaseRequest<Array<{ id: string; created_at: string; canonical_id: string; effective_at: string; record_type: MarketMemoryRecordType; source_id: string }>>(
      `market_memory?select=id,created_at,canonical_id,effective_at,record_type,source_id&dedupe_key=in.(${encodeURIComponent(query)})`,
      { method: "GET" },
    );

    const byKey = new Map(existing.map((row) => [`${row.record_type}:${row.canonical_id}:${row.effective_at}`, row]));
    return entries.map((entry) => buildRecord(entry, byKey.get(dedupeKey(entry))));
  }

  async findByCanonicalId(canonicalId: string): Promise<MarketMemoryRecord[]> {
    const rows = await supabaseRequest<Array<{ id: string; created_at: string; canonical_id: string; effective_at: string; record_type: MarketMemoryRecordType; source_id: string }>>(
      `market_memory?select=id,created_at,canonical_id,effective_at,record_type,source_id&canonical_id=eq.${encodeURIComponent(canonicalId)}&order=effective_at.desc`,
      { method: "GET" },
    );
    return rows.map((row) => ({
      id: row.id,
      type: row.record_type,
      recordedAt: row.created_at,
      effectiveAt: row.effective_at,
      sourceId: row.source_id ?? "",
      canonicalId: row.canonical_id ?? canonicalId,
    }));
  }
}

export class NonDurableMarketMemoryStore implements MarketMemoryStore {
  private readonly records: MarketMemoryRecord[] = [];

  async append(input: MarketMemoryAppendInput): Promise<MarketMemoryRecord> {
    const entry = entryFromInput(input);
    const record = buildRecord(entry);
    this.records.push(record);
    return record;
  }

  async appendMany(input: MarketMemoryAppendInput[]): Promise<MarketMemoryRecord[]> {
    const records = input.map((item) => buildRecord(entryFromInput(item)));
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
