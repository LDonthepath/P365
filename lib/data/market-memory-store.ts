import "server-only";

import { createHash } from "node:crypto";
import type { Evidence, Event, Observation, State } from "../domain/types";
import type { MarketMemoryAppendInput, MarketMemoryRecord, MarketMemoryStore } from "../domain/market-memory";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function config() {
  if (!URL || !KEY) throw new Error("Supabase Market Memory requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return { url: URL.replace(/\/$/, ""), key: KEY };
}

function canonical(input: MarketMemoryAppendInput) {
  const values = [
    input.observation && ["OBSERVATION", input.observation, input.observation.observedAt, input.observation.sourceId],
    input.event && ["EVENT", input.event, input.event.occurredAt ?? input.event.scheduledAt, input.event.sourceId],
    input.evidence && ["EVIDENCE", input.evidence, input.evidence.capturedAt, input.evidence.sourceId],
    input.state && ["STATE", input.state, input.state.evaluatedAt, input.state.domain],
  ].filter(Boolean) as Array<[MarketMemoryRecord["type"], Observation | Event | Evidence | State, string | undefined, string]>;
  if (values.length !== 1 || !values[0][2]) throw new Error("Market Memory append requires exactly one canonical object with a valid effective timestamp.");
  return { type: values[0][0], item: values[0][1], effectiveAt: values[0][2]!, sourceId: values[0][3] };
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function mapRow(row: Record<string, unknown>): MarketMemoryRecord {
  return {
    id: String(row.id),
    type: row.record_type as MarketMemoryRecord["type"],
    recordedAt: String(row.created_at),
    effectiveAt: String(row.effective_at),
    sourceId: String(row.source_id),
    canonicalId: String(row.canonical_id),
    payloadHash: typeof row.payload_hash === "string" ? row.payload_hash : undefined,
  };
}

export class SupabaseMarketMemoryStore implements MarketMemoryStore {
  private async request(path: string, init: RequestInit) {
    const { url, key } = config();
    const headers = new Headers(init.headers);
    headers.set("apikey", key);
    headers.set("Authorization", `Bearer ${key}`);
    headers.set("Content-Type", "application/json");
    return fetch(`${url}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  }

  async append(input: MarketMemoryAppendInput) {
    const rows = await this.appendMany([input]);
    return rows[0];
  }

  async appendMany(inputs: MarketMemoryAppendInput[]) {
    if (!inputs.length) return [];
    const rows = inputs.map((input) => {
      const value = canonical(input);
      const payload = value.item;
      return {
        record_type: value.type,
        canonical_id: value.item.id,
        source_id: value.sourceId,
        captured_at: new Date().toISOString(),
        effective_at: value.effectiveAt,
        payload,
        payload_hash: hash(payload),
        observation_ids: value.type === "OBSERVATION" ? [value.item.id] : [],
        event_ids: value.type === "EVENT" ? [value.item.id] : [],
        evidence_ids: value.type === "EVIDENCE" ? [value.item.id] : [],
      };
    });
    const response = await this.request("market_memory?on_conflict=dedupe_key", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new Error(`Market Memory persistence failed (${response.status}): ${await response.text()}`);
    const inserted = (await response.json()) as Record<string, unknown>[];
    if (inserted.length === rows.length) return inserted.map(mapRow);

    const filters = rows.map((row) => `dedupe_key.eq.${encodeURIComponent(`${row.record_type}:${row.canonical_id}:${row.effective_at}`)}`).join(",");
    const lookup = await this.request(`market_memory?or=(${filters})&select=id,record_type,created_at,effective_at,source_id,canonical_id,payload_hash`, { method: "GET" });
    if (!lookup.ok) throw new Error(`Market Memory lookup failed (${lookup.status}): ${await lookup.text()}`);
    const found = (await lookup.json()) as Record<string, unknown>[];
    const byKey = new Map(found.map((row) => [`${row.record_type}:${row.canonical_id}:${row.effective_at}`, row]));
    return rows.map((row) => {
      const match = byKey.get(`${row.record_type}:${row.canonical_id}:${row.effective_at}`);
      if (!match) throw new Error(`Market Memory row missing after persistence: ${row.canonical_id}`);
      return mapRow(match);
    });
  }

  async findByCanonicalId(canonicalId: string) {
    const response = await this.request(`market_memory?canonical_id=eq.${encodeURIComponent(canonicalId)}&select=id,record_type,created_at,effective_at,source_id,canonical_id,payload_hash&order=effective_at.desc`, { method: "GET" });
    if (!response.ok) throw new Error(`Market Memory query failed (${response.status}): ${await response.text()}`);
    return ((await response.json()) as Record<string, unknown>[]).map(mapRow);
  }
}
