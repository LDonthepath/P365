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
  assert.match(code, /const materialMoveMonitorPromise = buildMaterialMoveMonitor\([\s\S]*?observations: scopedObservations/);
  const body = code.split("export async function getDashboardData(): Promise<DashboardData> {")[1];
  assert.ok(body);
  assert.doesNotMatch(body, /ingestDashboardData\(|fetch[A-Z]/);
  assert.equal((body.match(/dashboardHistoricalObservationRepository/g) || []).length, 1);
  assert.match(body, /if \(elapsedMs >= 5_000\)/);
  assert.match(body, /observationReads: readScope\.stats\(\)/);
});
