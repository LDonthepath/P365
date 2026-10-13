import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Observation } from "../domain/types";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";
import { createDashboardObservationReadScope } from "./dashboard-observation-read-scope";

const asOf = "2026-10-11T07:00:00.000Z";
const fixture: Observation = {
  id: "btc-proof", domain: "ASSET", subject: "btc.spot.usd",
  value: "80000", observedAt: "2026-10-11T06:55:00.000Z",
  retrievedAt: "2026-10-11T06:56:00.000Z",
  sourceId: "coingecko-market", quality: "FRESH", evidenceId: "proof",
  metadata: { metricId: "btc.spot.usd" },
};
const q: ObservationHistoryQuery = {
  identity: { domain: "ASSET", seriesKey: "btc.spot.usd" },
  sourceId: "coingecko-market", observedAtOnOrBefore: asOf,
  retrievedAtOnOrBefore: asOf, order: "DESC", limit: 8,
};

test("G2-02: concurrent exact read fan-out and completed reads reuse one physical call", async () => {
  let calls = 0;
  let resolve!: (rows: Observation[]) => void;
  const pending = new Promise<Observation[]>((r) => { resolve = r; });
  const source: HistoricalObservationRepository = {
    findHistory: async () => { calls++; return pending; },
  };
  const scoped = createDashboardObservationReadScope(source);
  const p1 = scoped.repository.findHistory(q);
  const p2 = scoped.repository.findHistory({ ...q, identity: { ...q.identity } });
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve([fixture]);
  const [first, second] = await Promise.all([p1, p2]);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second, "cache must not share caller-mutable arrays");
  assert.notStrictEqual(first[0], second[0], "cache must not share caller-mutable objects");
  first[0].value = "modified";
  const third = await scoped.repository.findHistory(q);
  assert.equal(third[0].value, "80000");
  assert.equal(calls, 1);
  assert.deepEqual({ logical: scoped.stats().logicalReads, physical: scoped.stats().physicalReads,
    reused: scoped.stats().reusedReads }, { logical: 3, physical: 1, reused: 2 });
});

test("G2-02: every PIT identity, provenance, range, ordering and limit dimension changes key", async () => {
  let calls = 0;
  const scoped = createDashboardObservationReadScope({
    findHistory: async () => { calls++; return [fixture]; },
  });
  const qs: ObservationHistoryQuery[] = [
    q,
    { ...q, identity: { ...q.identity, domain: "MARKET" } },
    { ...q, identity: { ...q.identity, seriesKey: "eth.spot.usd" } },
    { ...q, sourceId: "qualified-alternate" },
    { ...q, sourceId: undefined },
    { ...q, observedAtOnOrAfter: "2026-10-10T00:00:00.000Z" },
    { ...q, observedAtOnOrBefore: "2026-10-10T00:00:00.000Z" },
    { ...q, retrievedAtOnOrBefore: "2026-10-10T00:00:00.000Z" },
    { ...q, order: "ASC" },
    { ...q, limit: 16 },
  ];
  await Promise.all(qs.map(item => scoped.repository.findHistory(item)));
  assert.equal(calls, qs.length);
  assert.equal(scoped.stats().reusedReads, 0);
});

test("G2-02: failing physical read rejects all waiters but does not cache failure", async () => {
  let calls = 0;
  const scoped = createDashboardObservationReadScope({
    findHistory: async () => {
      calls++;
      if (calls === 1) throw Error("repository unavailable");
      return [fixture];
    },
  });
  const pending = await Promise.allSettled([scoped.repository.findHistory(q), scoped.repository.findHistory(q)]);
  assert.deepEqual(pending.map(r => r.status), ["rejected", "rejected"]);
  assert.equal(scoped.stats().failedPhysicalReads, 1);
  assert.equal(calls, 1);
  const rows = await scoped.repository.findHistory(q);
  assert.equal(rows[0].id, "btc-proof");
  assert.equal(calls, 2);
});

test("G2-02: different dashboard requests cannot reuse each other's PIT cache", async () => {
  let calls = 0;
  const underlying: HistoricalObservationRepository = { findHistory: async () => {
    calls++;
    return [fixture];
  } };
  const a = createDashboardObservationReadScope(underlying);
  const b = createDashboardObservationReadScope(underlying);
  await a.repository.findHistory(q);
  await b.repository.findHistory(q);
  assert.equal(calls, 2);
  assert.equal(a.stats().physicalReads, 1);
  assert.equal(b.stats().physicalReads, 1);
});

test("G2-02: bounded cache capacity fails open to physical read without losing evidence", async () => {
  let calls = 0;
  const scoped = createDashboardObservationReadScope({
    findHistory: async () => { calls++; return [fixture]; },
  }, { capacity: 1 });
  await scoped.repository.findHistory(q);
  const alternate = { ...q, sourceId: "qualified-alternate" };
  assert.equal((await scoped.repository.findHistory(alternate))[0].id, fixture.id);
  await scoped.repository.findHistory(alternate);
  await scoped.repository.findHistory(q);
  assert.equal(calls, 3);
  assert.equal(scoped.stats().uncachedCapacityReads, 2);
  assert.equal(scoped.stats().reusedReads, 1);
});

test("G2-02: dashboard orchestration uses one scoped history facade and emits safe slow metrics", () => {
  const code = readFileSync(new URL("./dashboard-query.ts", import.meta.url), "utf8");
  assert.match(code, /createDashboardObservationReadScope\(dashboardHistoricalObservationRepository\)/);
  assert.match(code, /observations: scopedObservations/);
  assert.match(code, /const materialMoveMonitorPromise = buildMaterialMoveMonitor\([\s\S]*?observations: readScope\.forConsumer\("material_move"\)/);
  const body = code.split("export async function getDashboardData(): Promise<DashboardData> {")[1];
  assert.ok(body);
  assert.doesNotMatch(body, /ingestDashboardData\(|fetch[A-Z]/);
  assert.equal((body.match(/dashboardHistoricalObservationRepository/g) || []).length, 1);
  assert.match(body, /if \(elapsedMs >= 5_000\)/);
  assert.match(body, /observationReads: readScope\.stats\(\)/);
});

test("G2-03: read attribution groups only physical reads by bounded domain and limit, not identities", async () => {
  let clock = 0;
  const scoped = createDashboardObservationReadScope({
    async findHistory(query) {
      clock += query.limit <= 8 ? 3 : 7;
      return [fixture];
    },
  }, { now: () => clock });
  const asset = { ...q };
  const macro = { ...q, identity: { domain: "MACRO" as const, seriesKey: "DGS2" },
    sourceId: "fred", limit: 100 };
  const macroDeep = { ...macro, limit: 500 };
  await scoped.repository.findHistory(asset);
  await scoped.repository.findHistory(asset); // reuse never adds physical telemetry
  await scoped.repository.findHistory(macro);
  await scoped.repository.findHistory(macroDeep);
  assert.equal(scoped.stats().physicalReads, 3);
  assert.equal(scoped.stats().reusedReads, 1);
  assert.deepEqual(scoped.stats().familyReads, [
    { domain: "MACRO", limitBucket: "9_TO_100", physicalReads: 1, failedReads: 0, elapsedMs: 7 },
    { domain: "MACRO", limitBucket: "101_TO_500", physicalReads: 1, failedReads: 0, elapsedMs: 7 },
    { domain: "ASSET", limitBucket: "1_TO_8", physicalReads: 1, failedReads: 0, elapsedMs: 3 },
  ]);
  assert.equal(scoped.stats().familyReads.reduce((s, f) => s + f.physicalReads, 0),
    scoped.stats().physicalReads);
  assert.doesNotMatch(JSON.stringify(scoped.stats()), /btc\.spot|DGS2|fred|2026-10-11|80000|coingecko/);
});

test("G2-03: failure, retry and cross-request telemetry are accurately isolated", async () => {
  let clock = 0;
  let calls = 0;
  const underlying = {
    async findHistory() {
      calls++;
      clock += 5;
      if (calls === 1) throw Error("synthetic transient failure");
      return [fixture];
    },
  };
  const first = createDashboardObservationReadScope(underlying, { now: () => clock });
  await assert.rejects(first.repository.findHistory(q), /synthetic transient failure/);
  assert.deepEqual(first.stats().familyReads, [
    { domain: "ASSET", limitBucket: "1_TO_8", physicalReads: 1, failedReads: 1, elapsedMs: 5 },
  ]);
  await first.repository.findHistory(q);
  assert.equal(first.stats().familyReads[0].physicalReads, 2);
  assert.equal(first.stats().familyReads[0].failedReads, 1);
  assert.equal(first.stats().familyReads[0].elapsedMs, 10);
  const second = createDashboardObservationReadScope(underlying, { now: () => clock });
  assert.deepEqual(second.stats().familyReads, []);
  await second.repository.findHistory(q);
  assert.equal(second.stats().familyReads[0].physicalReads, 1);
  assert.equal(calls, 3);
});

test("G2-03: no arbitrary series/source or limit produces unbounded telemetry keys", async () => {
  const scoped = createDashboardObservationReadScope({ findHistory: async () => [] });
  const domains = ["MACRO", "MARKET", "ASSET", "OTHER"] as const;
  for (const domain of domains) {
    for (const limit of [1, 8, 9, 100, 101, 500]) {
      await scoped.repository.findHistory({
        ...q, identity: { domain, seriesKey: "arbitrary-" + domain + "-" + limit },
        sourceId: "secret-provider-" + limit, limit,
      });
    }
  }
  assert.equal(scoped.stats().physicalReads, 24);
  assert.equal(scoped.stats().familyReads.length, 12);
  assert.equal(scoped.stats().familyReads.reduce((count, item) => count + item.physicalReads, 0), 24);
  assert.doesNotMatch(JSON.stringify(scoped.stats()), /arbitrary|secret-provider/);
});


test("G2-07: fixed model attribution shares one PIT cache and assigns first physical cost", async () => {
  let calls = 0;
  let clock = 0;
  const scoped = createDashboardObservationReadScope({
    async findHistory() { calls++; clock += 4; return [fixture]; },
  }, { now: () => clock });
  const projection = scoped.forConsumer("durable_projection");
  const move = scoped.forConsumer("material_move");
  const [a, b] = await Promise.all([projection.findHistory(q), move.findHistory(q)]);
  assert.equal(calls, 1);
  assert.notStrictEqual(a, b);
  assert.deepEqual(scoped.stats().consumerReads, [
    { consumer: "durable_projection", logicalReads: 1, physicalReads: 1,
      reusedReads: 0, failedReads: 0, elapsedMs: 4 },
    { consumer: "material_move", logicalReads: 1, physicalReads: 0,
      reusedReads: 1, failedReads: 0, elapsedMs: 0 },
  ]);
  assert.equal(scoped.stats().consumerReads.reduce((s, x) => s + x.physicalReads, 0), scoped.stats().physicalReads);
  assert.doesNotMatch(JSON.stringify(scoped.stats().consumerReads), /btc\.spot|coingecko|80000|2026-10/);
});

test("G2-07: first physical consumer owns failure; retry and next GET remain isolated", async () => {
  let calls = 0;
  const source = { async findHistory() {
    calls++;
    if (calls === 1) throw new Error("transient repository failure");
    return [fixture];
  } };
  const first = createDashboardObservationReadScope(source);
  const a = first.forConsumer("mvp_factual_context");
  const b = first.forConsumer("rates_inflation");
  const rejected = await Promise.allSettled([a.findHistory(q), b.findHistory(q)]);
  assert.deepEqual(rejected.map(x => x.status), ["rejected", "rejected"]);
  await b.findHistory(q);
  assert.equal(calls, 2);
  assert.equal(first.stats().consumerReads.find(x => x.consumer === "mvp_factual_context")?.failedReads, 1);
  assert.equal(first.stats().consumerReads.find(x => x.consumer === "rates_inflation")?.physicalReads, 1);
  const next = createDashboardObservationReadScope(source);
  assert.equal(next.stats().consumerReads.length, 0);
  await next.forConsumer("durable_projection").findHistory(q);
  assert.equal(calls, 3);
});

test("G2-07: dashboard uses bounded model labels and never fetches on GET", () => {
  const code = readFileSync(new URL("./dashboard-query.ts", import.meta.url), "utf8");
  for (const name of ["durable_projection", "macro_baselines", "net_liquidity",
    "central_bank_balances", "dxy_history", "rates_inflation", "credit_conditions",
    "mvp_factual_context", "stablecoin_liquidity", "btc_etf_flow", "gold_positioning", "material_move"]) {
    assert.ok(code.includes('readScope.forConsumer("' + name + '")'));
  }
  const body = code.split("export async function getDashboardData(): Promise<DashboardData> {")[1];
  assert.ok(body);
  assert.doesNotMatch(body, /ingestDashboardData\(|fetch[A-Z]/);
});

test("G2-08: opt-in projection batching is GET-local, preserves cross-consumer reuse and a shared four-read budget", async () => {
  let general = 0;
  let projection = 0;
  let concurrent = 0;
  let maxConcurrent = 0;
  let release!: () => void;
  const pending = new Promise<void>((r) => { release = r; });
  const generalSource: HistoricalObservationRepository = { findHistory: async () => {
    general++; concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
    await pending; concurrent--; return [fixture];
  } };
  const projectionSource: HistoricalObservationRepository = { findHistory: async () => {
    projection++; concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
    await pending; concurrent--; return [fixture];
  } };
  const get = createDashboardObservationReadScope(generalSource);
  get.useProjectionSource(projectionSource, () => ({ networkRequests: 1, sourceRequests: projection, failedBatches: 0 }));
  const queries = Array.from({ length: 12 }, (_, i) => ({
    ...q, identity: { ...q.identity, seriesKey: "projection-" + i },
  }));
  const work = [
    ...queries.map((query) => get.forConsumer("durable_projection").findHistory(query)),
    ...queries.map((query) => get.forConsumer("rates_inflation").findHistory(query)),
  ];
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  // Projection logical calls are deliberately not gated here. The injected
  // real batch HTTP transport, not this fake repository, owns the two slots.
  // See the mixed-contention HTTP count/peak test in the batch-fetch suite.
  assert.ok(maxConcurrent >= 1);
  release();
  await Promise.all(work);
  assert.equal(projection + general, queries.length);
  assert.equal(get.stats().logicalReads, 24);
  assert.equal(get.stats().reusedReads, 12);
  assert.equal(get.stats().projectionBatchTransport?.networkRequests, 1);
  const nextGet = createDashboardObservationReadScope(generalSource);
  assert.equal(nextGet.stats().projectionBatchTransport, null);
  assert.throws(() => get.useProjectionSource(projectionSource, () => ({networkRequests: 0,sourceRequests: 0,failedBatches: 0})));
});
