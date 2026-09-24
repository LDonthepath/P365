import "server-only";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Context, Event, Evidence, Observation } from "../domain/types";
import type { ContextRepository, EventRepository, EvidenceRepository, MarketSnapshotRepository, ObservationRepository } from "../repositories/types";
import { SupabaseHistoricalObservationRepository } from "./supabase-observation-history";
import { marketMemoryDedupeKey, marketMemoryEffectiveAt, type CanonicalRecord, type MarketMemoryRecordType } from "./market-memory-record";

type MarketMemoryRow = {
  record_type: MarketMemoryRecordType;
  canonical_id: string;
  effective_at: string;
  captured_at: string;
  dedupe_key: string;
  payload: CanonicalRecord;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.P365_MEMORY_WRITE_KEY ?? process.env.SUPABASE_SECRET_KEY;

function requireConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("P365 durable Market Memory requires SUPABASE_URL and a server-only Supabase write key.");
  }

  return { url: SUPABASE_URL.replace(/\/$/, ""), key: SUPABASE_KEY };
}

function rowFor(recordType: MarketMemoryRecordType, record: CanonicalRecord): MarketMemoryRow {
  const effective = marketMemoryEffectiveAt(recordType, record);
  return {
    record_type: recordType,
    canonical_id: record.id,
    effective_at: effective,
    // Write-time timestamp for this memory row — distinct from effective_at,
    // which is the record's own semantic time (when the fact was true, not
    // when P365 wrote it to memory).
    captured_at: new Date().toISOString(),
    dedupe_key: marketMemoryDedupeKey(recordType, record),
    payload: record,
  };
}

async function insertMany(rows: MarketMemoryRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { url, key } = requireConfig();
  const response = await fetch(`${url}/rest/v1/market_memory?on_conflict=dedupe_key`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Market Memory write failed (${response.status}): ${detail}`);
  }
}

async function find<T extends CanonicalRecord>(recordType: MarketMemoryRecordType, id: string): Promise<T | null> {
  const { url, key } = requireConfig();
  const params = new URLSearchParams({
    select: "payload",
    record_type: `eq.${recordType}`,
    canonical_id: `eq.${id}`,
    limit: "1",
  });
  const response = await fetch(`${url}/rest/v1/market_memory?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Market Memory read failed (${response.status}): ${detail}`);
  }

  const rows = (await response.json()) as Array<{ payload: T }>;
  return rows[0]?.payload ?? null;
}

class SupabaseRepository<T extends CanonicalRecord> {
  constructor(private readonly recordType: MarketMemoryRecordType) {}

  async save(item: T): Promise<void> {
    await insertMany([rowFor(this.recordType, item)]);
  }

  async saveMany(items: T[]): Promise<void> {
    await insertMany(items.map((item) => rowFor(this.recordType, item)));
  }

  async findById(id: string): Promise<T | null> {
    return find<T>(this.recordType, id);
  }
}

export const supabaseCanonicalRepositories = {
  observations: new SupabaseRepository<Observation>("OBSERVATION") satisfies ObservationRepository,
  events: new SupabaseRepository<Event>("EVENT") satisfies EventRepository,
  evidence: new SupabaseRepository<Evidence>("EVIDENCE") satisfies EvidenceRepository,
  contexts: new SupabaseRepository<Context>("CONTEXT") satisfies ContextRepository,
};

export const supabaseMarketSnapshotRepository =
  new SupabaseRepository<MarketSnapshot>("SNAPSHOT") satisfies MarketSnapshotRepository;

export const supabaseHistoricalObservationRepository = new SupabaseHistoricalObservationRepository({ config: requireConfig });
export { SupabaseHistoricalObservationRepository } from "./supabase-observation-history";
