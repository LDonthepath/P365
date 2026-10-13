import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { SupabaseHistoricalObservationRepository } from "./supabase-observation-history";
import { createDashboardBatchFetch } from "./dashboard-observation-batch-fetch";
import { createDashboardObservationReadScope } from "../application/dashboard-observation-read-scope";
import type { HistoricalObservationRepository } from "../repositories/types";

const asOf = "2026-10-11T00:00:00.000Z";
const prior = "2026-10-10T00:00:00.000Z";
const future = "2026-10-12T00:00:00.000Z";
function point(id: string, series: string, time: string, retrievedAt = prior): Observation {
  return { id, domain: "MACRO", subject: series, value: id, observedAt: time, retrievedAt,
    sourceId: "fred", quality: "FRESH", evidenceId: "e-" + id, metadata: { seriesId: series } };
}
type Candidate = { id: string; effective_at: string; payload: unknown };
type RpcArgs = { p_domain: string; p_series_key: string; p_source_id: string | null;
  p_observed_at_on_or_after: string | null; p_observed_at_on_or_before: string | null;
  p_captured_at_on_or_before: string; p_sort_desc: boolean; p_limit: number; p_offset: number };
function harness(points: Observation[], failure = false) {
  let physicalPosts = 0;
  const fetched = (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    physicalPosts++;
    if (failure) return new Response("rpc unavailable", { status: 404 });
    const requests = (JSON.parse(String(init?.body)) as { p_requests: RpcArgs[] }).p_requests;
    assert.ok(requests.length > 0 && requests.length <= 16);
    const rows: Array<Candidate & { request_index: number }> = [];
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const matching = points
        .filter((p) => p.domain === request.p_domain && p.metadata?.seriesId === request.p_series_key
          && (request.p_source_id === null || p.sourceId === request.p_source_id)
          && (!request.p_observed_at_on_or_before || Date.parse(p.observedAt) <= Date.parse(request.p_observed_at_on_or_before)))
        .sort((a, b) => (Date.parse(b.observedAt) - Date.parse(a.observedAt)) || b.id.localeCompare(a.id))
        .slice(request.p_offset, request.p_offset + request.p_limit);
      for (const p of matching) rows.push({ request_index: i + 1, id: p.id, effective_at: p.observedAt, payload: p });
    }
    return new Response(JSON.stringify(rows), { status: 200 });
  }) as typeof fetch;
  const transport = createDashboardBatchFetch(fetched);
  const repository = new SupabaseHistoricalObservationRepository({
    fetch: transport.fetch,
    config: () => ({ url: "https://private.example", key: "test-only-key" }),
  });
  // Independent original single-series transport on identical fixtures,
  // using the same candidate generator without the new batch client.
  const independentFetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const original = JSON.parse(String(init?.body ?? "{}")) as RpcArgs;
    const response = await fetched(input, { ...init, body: JSON.stringify({ p_requests: [original] }) });
    if (!response.ok) return response;
    const rows = (await response.json()) as Array<Candidate & { request_index: number }>;
    return new Response(JSON.stringify(rows.map((row) => ({ id: row.id, effective_at: row.effective_at, payload: row.payload }))), { status: 200 });
  }) as typeof fetch;
  const independent = new SupabaseHistoricalObservationRepository({
    fetch: independentFetcher, config: () => ({ url: "https://private.example", key: "test-only-key" }),
  });
  const query = (seriesKey: string, cutoff = asOf) => ({
    identity: { domain: "MACRO" as const, seriesKey }, sourceId: "fred",
    observedAtOnOrBefore: cutoff, retrievedAtOnOrBefore: cutoff,
    order: "DESC" as const, limit: 8,
  });
  return { repository, independent, query, transport, getPosts: () => physicalPosts };
}

test("G2-08: 50 independent histories use fewer physical network calls without changing identities", async () => {
  const series = Array.from({ length: 50 }, (_, i) => "S" + i);
  const data = series.flatMap((s) => Array.from({ length: 12 }, (_, i) =>
    point(s + "-" + i, s, new Date(Date.parse(prior) - i * 86400000).toISOString())));
  const h = harness(data);
  const results = await Promise.all(series.map((s) => h.repository.findHistory(h.query(s))));
  results.forEach((rows, i) => assert.deepEqual(rows.map((p) => p.id),
    Array.from({ length: 8 }, (_, j) => series[i] + "-" + j)));
  const batchPosts = h.getPosts();
  assert.equal(h.transport.stats().sourceRequests, 50);
  assert.ok(batchPosts < 50);
  assert.equal(h.transport.stats().networkRequests, batchPosts);
  const independent = await Promise.all(series.map((s) => h.independent.findHistory(h.query(s))));
  assert.deepEqual(results, independent, "same 50 full canonical results as independent RPC transport");
  assert.equal(h.getPosts() - batchPosts, 50, "one independent HTTP read per original series");
});

test("G2-08: correction ties, future-known observations, empty, invalid and independently copied results", async () => {
  const tie = Array.from({ length: 25 }, (_, i) =>
    point("rev-" + String(i).padStart(2, "0"), "REVISIONS", prior,
      new Date(Date.parse(prior) + 120000 + i * 1000).toISOString()));
  const dense = Array.from({ length: 22 }, (_, i) =>
    point("future-" + i, "FUTURE", new Date(Date.parse(prior) - i * 1000).toISOString(), future));
  const known = Array.from({ length: 10 }, (_, i) =>
    point("known-" + i, "FUTURE", new Date(Date.parse(prior) - (i + 22) * 1000).toISOString()));
  const malformed = { ...point("malformed", "FUTURE", prior), retrievedAt: undefined } as unknown as Observation;
  const h = harness([...tie, ...dense, ...known, malformed]);
  const [revisions, futureRows, empty] = await Promise.all([
    h.repository.findHistory(h.query("REVISIONS")),
    h.repository.findHistory(h.query("FUTURE")),
    h.repository.findHistory(h.query("EMPTY")),
  ]);
  assert.equal(revisions.length, 8);
  assert.deepEqual(revisions.map((x) => x.id), Array.from({ length: 8 }, (_, i) => "rev-" + String(24 - i).padStart(2, "0")));
  assert.deepEqual(futureRows.map((x) => x.id), known.slice(0, 8).map((x) => x.id));
  assert.deepEqual(empty, []);
  assert.deepEqual(
    [revisions, futureRows, empty],
    await Promise.all(["REVISIONS", "FUTURE", "EMPTY"].map((key) => h.independent.findHistory(h.query(key)))),
    "revision, no-look-ahead and empty cases match original single-series adapter exactly",
  );
  assert.ok(h.transport.stats().sourceRequests > 3, "pagination is not truncated to the first batch");
  futureRows[0].value = "mutated";
  const again = await h.repository.findHistory(h.query("FUTURE"));
  assert.equal(again[0].value, "known-0");
});

test("G2-08: unavailable batch RPC fails closed without single-RPC fallback or partial response", async () => {
  const h = harness([point("a", "A", prior), point("b", "B", prior)], true);
  const settled = await Promise.allSettled([
    h.repository.findHistory(h.query("A")), h.repository.findHistory(h.query("B")),
  ]);
  assert.deepEqual(settled.map((r) => r.status), ["rejected", "rejected"]);
  assert.equal(h.getPosts(), 1);
  assert.equal(h.transport.stats().failedBatches, 1);
});

test("G2-08: batched transport is newly allocated per GET, never shares history or mutable buffers", async () => {
  const points = [point("x", "X", prior)];
  const first = harness(points);
  const second = harness(points);
  await first.repository.findHistory(first.query("X"));
  assert.equal(first.getPosts(), 1);
  assert.equal(second.getPosts(), 0);
  await second.repository.findHistory(second.query("X"));
  assert.equal(second.getPosts(), 1);
});


test("G2-09: mixed dashboard readers must coalesce 50 projection requests within four network slots", async () => {
  const pause = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });
  let generalInFlight = 0;
  let peakGeneral = 0;
  const releaseGeneral: Array<() => void> = [];
  const general: HistoricalObservationRepository = {
    async findHistory() {
      generalInFlight++;
      peakGeneral = Math.max(peakGeneral, generalInFlight);
      await new Promise<void>((resolve) => { releaseGeneral.push(resolve); });
      generalInFlight--;
      return [];
    },
  };
  let httpInFlight = 0;
  let peakHttp = 0;
  const http = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    httpInFlight++;
    peakHttp = Math.max(peakHttp, httpInFlight);
    try {
      await pause(2);
      const request = JSON.parse(String(init?.body)) as { p_requests: RpcArgs[] };
      assert.ok(request.p_requests.length >= 1 && request.p_requests.length <= 16);
      return new Response(JSON.stringify(request.p_requests.map((part, index) => ({
        request_index: index + 1,
        id: "id-" + part.p_series_key,
        effective_at: prior,
        payload: point("id-" + part.p_series_key, part.p_series_key, prior),
      }))), { status: 200 });
    } finally {
      httpInFlight--;
    }
  }) as typeof fetch;
  const transport = createDashboardBatchFetch(http);
  const projection = new SupabaseHistoricalObservationRepository({
    fetch: transport.fetch, config: () => ({ url: "https://private.example", key: "test-only-key" }),
  });
  const scope = createDashboardObservationReadScope(general);
  scope.useProjectionSource(projection, transport.stats);
  const query = (key: string) => ({
    identity: { domain: "MACRO" as const, seriesKey: key }, sourceId: "fred",
    observedAtOnOrBefore: asOf, retrievedAtOnOrBefore: asOf, order: "DESC" as const, limit: 8,
  });

  // Ordinary dashboard consumers arrive first; production had other model
  // reads in flight before all 50 durable projection reads were dispatched.
  const ordinary = Array.from({ length: 4 }, (_, i) =>
    scope.forConsumer("rates_inflation").findHistory(query("OTHER-" + i)));
  await pause(3);
  const results = Promise.all(Array.from({ length: 50 }, (_, i) =>
    scope.forConsumer("durable_projection").findHistory(query("BATCH-" + i))));

  // Releasing a slow ordinary reader at a time must not make the
  // projection HTTP client send a singleton request per candidate page.
  for (let i = 0; i < 4; i++) {
    for (let attempt = 0; releaseGeneral.length === 0 && attempt < 300; attempt++) await pause(1);
    assert.ok(releaseGeneral.length > 0, "ordinary source read never acquired a slot");
    releaseGeneral.shift()!();
    await pause(8);
  }
  const [observations] = await Promise.all([results, Promise.all(ordinary)]);
  assert.equal(observations.length, 50);
  observations.forEach((rows, index) => {
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "id-BATCH-" + index);
  });
  const stats = transport.stats();
  assert.equal(stats.sourceRequests, 50);
  assert.ok(stats.networkRequests < 50, "must reduce physical HTTP POSTs versus 50 source requests");
  assert.ok(stats.networkRequests <= 10, "bounded mixed contention must coalesce into <=10 HTTP POSTs");
  assert.ok(peakGeneral <= 2, "reserve at most two general HTTP slots while batch transport is active");
  assert.ok(peakHttp <= 2, "batch transport may use at most two HTTP slots");
  assert.ok(peakGeneral + peakHttp <= 4, "combined physical network concurrency stays <=4");
  assert.equal(stats.failedBatches, 0);
});
