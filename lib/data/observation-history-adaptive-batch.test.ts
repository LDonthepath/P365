import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseHistoricalObservationRepository } from "./supabase-observation-history";
import type { Observation } from "../domain/types";

const AS_OF = "2026-10-11T00:00:00.000Z";
const BEFORE = "2026-10-10T00:00:00.000Z";
const AFTER = "2026-10-12T00:00:00.000Z";

function point(id: string, observedAt: string, retrievedAt = BEFORE): Observation {
  return {
    id,
    domain: "MACRO",
    subject: "Treasury yield",
    value: id,
    observedAt,
    retrievedAt,
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: `ev-${id}`,
    metadata: { seriesId: "DGS2" },
  };
}

function fakeHistory(rows: Observation[], candidateBatchSize?: number) {
  const requests: Array<{ limit: number; offset: number; after: string | null; before: string | null; sourceId: string | null }> = [];
  const fetcher = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      p_limit: number;
      p_offset: number;
      p_captured_at_on_or_before: string;
      p_source_id: string | null;
      p_observed_at_on_or_after: string | null;
      p_observed_at_on_or_before: string | null;
    };
    requests.push({
      limit: body.p_limit,
      offset: body.p_offset,
      after: body.p_observed_at_on_or_after,
      before: body.p_observed_at_on_or_before,
      sourceId: body.p_source_id,
    });
    const page = rows.filter((row) =>
      body.p_source_id === null || row.sourceId === body.p_source_id)
      .filter((row) => body.p_observed_at_on_or_before === null ||
        Date.parse(row.observedAt) <= Date.parse(body.p_observed_at_on_or_before))
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) ||
        b.id.localeCompare(a.id))
      .slice(body.p_offset, body.p_offset + body.p_limit)
      .map((row) => ({ id: "stored-" + row.id, effective_at: row.observedAt, payload: row }));
    return new Response(JSON.stringify(page), { status: 200 });
  }) as typeof fetch;
  const repository = new SupabaseHistoricalObservationRepository({
    fetch: fetcher,
    config: () => ({ url: "https://example.supabase.co", key: "test-only" }),
    ...(candidateBatchSize === undefined ? {} : { candidateBatchSize }),
  });
  return { repository, requests };
}

const query = (limit: number) => ({
  identity: { domain: "MACRO" as const, seriesKey: "DGS2" },
  sourceId: "fred",
  observedAtOnOrBefore: AS_OF,
  retrievedAtOnOrBefore: AS_OF,
  order: "DESC" as const,
  limit,
});

test("G5-04: latest 8 starts with 16 candidates instead of transferring 82 rows", async () => {
  const rows = Array.from({ length: 82 }, (_, i) =>
    point("p" + i, new Date(Date.UTC(2026, 9, 10) - i * 86_400_000).toISOString()));
  const { repository, requests } = fakeHistory(rows);
  const result = await repository.findHistory(query(8));
  assert.deepEqual(result.map((row) => row.id), rows.slice(0, 8).map((row) => row.id));
  assert.equal(requests.length, 1);
  assert.deepEqual(requests.map((request) => [request.limit, request.offset]), [[16, 0]]);
  assert.equal(requests[0].sourceId, "fred");
  assert.equal(requests[0].before, AS_OF);
});

test("G5-04: future-known candidates paginate until 8 prior-known readings, with no look-ahead", async () => {
  const rows = Array.from({ length: 48 }, (_, i) =>
    point("p" + i, new Date(Date.UTC(2026, 9, 10) - i * 86_400_000).toISOString(),
      i < 22 ? AFTER : BEFORE));
  const { repository, requests } = fakeHistory(rows);
  const result = await repository.findHistory(query(8));
  assert.deepEqual(result.map((row) => row.id), rows.slice(22, 30).map((row) => row.id));
  assert.deepEqual(requests.map((row) => [row.limit, row.offset]), [[16, 0], [16, 16]]);
});

test("G5-04: dense timestamp-revision group is not truncated at page boundary", async () => {
  const time = "2026-10-08T00:00:00.000Z";
  const rows = Array.from({ length: 25 }, (_, i) =>
    point("revision-" + String(i).padStart(2, "0"), time,
      new Date(Date.UTC(2026, 9, 9, 0, i)).toISOString()));
  const { repository, requests } = fakeHistory(rows);
  const result = await repository.findHistory(query(2));
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map((row) => [row.limit, row.offset]), [[16, 0], [16, 16]]);
  assert.deepEqual(result.map((row) => row.id), ["revision-24", "revision-23"]);
});

test("G5-04: large ranges keep the original 250 candidate cap and complete ordering", async () => {
  const rows = Array.from({ length: 270 }, (_, i) =>
    point("p" + i, new Date(Date.UTC(2026, 9, 10) - i * 86_400_000).toISOString()));
  const { repository, requests } = fakeHistory(rows);
  const result = await repository.findHistory(query(260));
  assert.equal(result.length, 260);
  assert.deepEqual(requests.map((row) => [row.limit, row.offset]), [[250, 0], [250, 250]]);
});

