import assert from "node:assert/strict";
import test from "node:test";
import { cmeGlobexGoldSessionKey } from "../domain/freshness";
import type { Observation } from "../domain/types";
import type {
  HistoricalObservationRepository,
  ObservationHistoryQuery,
} from "../repositories/types";
import {
  continuousPercentile,
  detectContinuousMarketMove,
} from "./continuous-move-detector";

const STEP_MS = 5 * 60 * 1000;

function observation(input: {
  id: string;
  observedAt: string;
  retrievedAt?: string;
  value: number;
  quality?: Observation["quality"];
}): Observation {
  return {
    id: input.id,
    domain: "ASSET",
    subject: "btc.spot.usd",
    value: String(input.value),
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt ?? input.observedAt,
    sourceId: "coingecko-market",
    quality: input.quality ?? "FRESH",
    evidenceId: "e-" + input.id,
    identity: {
      version: "v1",
      seriesKey: "btc.spot.usd",
      measurementId: "m-" + input.id,
      revisionFingerprint: "r-" + input.id,
    },
    metadata: {
      metricId: "btc.spot.usd",
      unit: "USD",
      frequency: "5m",
    },
  };
}

class MemoryHistory implements HistoricalObservationRepository {
  constructor(
    private readonly rows: Observation[],
    private readonly fail = false,
    private readonly forceLimit = false,
  ) {}

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    if (this.fail) throw new Error("synthetic repository failure");
    if (this.forceLimit) return Array.from({ length: 500 }, (_, index) =>
      observation({
        id: "forced-" + index,
        observedAt: new Date(Date.UTC(2026, 0, 1) + index * STEP_MS).toISOString(),
        value: 100,
      }));

    const rows = this.rows
      .filter((o) =>
        o.domain === query.identity.domain
        && o.identity?.seriesKey === query.identity.seriesKey
        && (!query.sourceId || o.sourceId === query.sourceId)
        && (!query.retrievedAtOnOrBefore || o.retrievedAt <= query.retrievedAtOnOrBefore)
        && (!query.observedAtOnOrAfter || o.observedAt >= query.observedAtOnOrAfter)
        && (!query.observedAtOnOrBefore || o.observedAt <= query.observedAtOnOrBefore))
      .sort((a, b) => {
        const sign = query.order === "ASC" ? 1 : -1;
        return sign * (
          a.observedAt.localeCompare(b.observedAt)
          || a.retrievedAt.localeCompare(b.retrievedAt)
          || a.id.localeCompare(b.id)
        );
      });
    return rows.slice(0, query.limit);
  }
}

function regularHistory(input?: {
  targetValue?: number;
  jitter15mStartMs?: number;
  remove15mStart?: boolean;
}): { rows: Observation[]; target: Observation; asOf: string } {
  const first = Date.UTC(2026, 0, 1, 8, 0, 0);
  const targetAt = Date.UTC(2026, 0, 3, 0, 0, 0);
  const rows: Observation[] = [];
  let index = 0;

  for (let at = first; at < targetAt; at += STEP_MS) {
    const desired15m = targetAt - 15 * 60 * 1000;
    if (input?.remove15mStart && at === desired15m) {
      index += 1;
      continue;
    }
    const observedAt = at === desired15m && input?.jitter15mStartMs
      ? at + input.jitter15mStartMs
      : at;
    rows.push(observation({
      id: "h-" + index,
      observedAt: new Date(observedAt).toISOString(),
      retrievedAt: new Date(observedAt + 10_000).toISOString(),
      value: 100 + index * 0.001,
    }));
    index += 1;
  }

  const target = observation({
    id: "target",
    observedAt: new Date(targetAt).toISOString(),
    retrievedAt: new Date(targetAt + 10_000).toISOString(),
    value: input?.targetValue ?? 110,
  });
  rows.push(target);

  return {
    rows,
    target,
    asOf: new Date(targetAt + 60_000).toISOString(),
  };
}

test("MOVE-001C percentile interpolation matches percentile_cont semantics", () => {
  assert.equal(continuousPercentile([0, 10, 20, 30, 40], 25), 10);
  assert.equal(continuousPercentile([0, 10, 20, 30], 25), 7.5);
  assert.equal(continuousPercentile([], 97.5), undefined);
});

test("MOVE-001C detects a material move across calibrated horizons", async () => {
  const fixture = regularHistory();
  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory(fixture.rows),
    seriesKey: "btc.spot.usd",
    targetEnd: fixture.target,
    asOf: fixture.asOf,
  });

  assert.equal(result.status, "MATERIAL_MOVE");
  assert.equal(result.hasMaterialMove, true);
  assert.equal(result.causalAttribution, "NOT_EVALUATED");
  assert.deepEqual(
    result.horizons.map((item) => item.status),
    ["MATERIAL_MOVE", "MATERIAL_MOVE", "MATERIAL_MOVE", "MATERIAL_MOVE"],
  );
  assert.ok(result.horizons.every((item) => item.historicalSampleSize >= 120));
  assert.ok(result.horizons.every((item) => (item.targetPercentileRank ?? 0) > 97.5));
});

test("MOVE-001C keeps ordinary moves below the rolling P97.5 threshold", async () => {
  const fixture = regularHistory({ targetValue: 100.48 });
  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory(fixture.rows),
    seriesKey: "btc.spot.usd",
    targetEnd: fixture.target,
    asOf: fixture.asOf,
  });

  assert.equal(result.status, "BELOW_MATERIALITY_THRESHOLD");
  assert.equal(result.hasMaterialMove, false);
  assert.ok(result.horizons.every(
    (item) => item.status === "BELOW_MATERIALITY_THRESHOLD",
  ));
});

test("MOVE-001C uses nearest elapsed-time pairing only inside ±60 seconds", async () => {
  const fixture = regularHistory({ jitter15mStartMs: 45_000 });
  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory(fixture.rows),
    seriesKey: "btc.spot.usd",
    targetEnd: fixture.target,
    asOf: fixture.asOf,
  });

  assert.equal(result.horizons[0].alignmentErrorMs, 45_000);
  assert.equal(result.horizons[0].targetStartObservedAt,
    new Date(Date.parse(fixture.target.observedAt) - 15 * 60 * 1000 + 45_000).toISOString());
});

test("MOVE-001C fails a horizon closed when no target start exists inside tolerance", async () => {
  const fixture = regularHistory({ remove15mStart: true });
  const nearby = Date.parse(fixture.target.observedAt) - 15 * 60 * 1000 + 120_000;
  fixture.rows.push(observation({
    id: "too-far",
    observedAt: new Date(nearby).toISOString(),
    retrievedAt: new Date(nearby + 10_000).toISOString(),
    value: 100,
  }));

  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory(fixture.rows),
    seriesKey: "btc.spot.usd",
    targetEnd: fixture.target,
    asOf: fixture.asOf,
  });

  assert.equal(result.horizons[0].status, "INSUFFICIENT_DATA");
  assert.match(result.horizons[0].reason ?? "", /alignment tolerance/);
});

test("MOVE-001C excludes later-known revisions from point-in-time history", async () => {
  const fixture = regularHistory({ targetValue: 100.48 });
  const revised = { ...fixture.rows[100] };
  revised.id = "later-revision";
  revised.value = "10000";
  revised.retrievedAt = "2026-01-04T00:00:00.000Z";
  revised.identity = {
    ...revised.identity!,
    revisionFingerprint: "later",
  };
  fixture.rows.push(revised);

  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory(fixture.rows),
    seriesKey: "btc.spot.usd",
    targetEnd: fixture.target,
    asOf: fixture.asOf,
  });

  assert.equal(result.status, "BELOW_MATERIALITY_THRESHOLD");
});

test("MOVE-001C returns UNKNOWN on repository failure", async () => {
  const fixture = regularHistory();
  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory(fixture.rows, true),
    seriesKey: "btc.spot.usd",
    targetEnd: fixture.target,
    asOf: fixture.asOf,
  });

  assert.equal(result.status, "UNKNOWN");
  assert.ok(result.horizons.every((item) => item.status === "UNKNOWN"));
});

test("MOVE-001C fails closed when a history query reaches the 500-row bound", async () => {
  const fixture = regularHistory();
  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory(fixture.rows, false, true),
    seriesKey: "btc.spot.usd",
    targetEnd: fixture.target,
    asOf: fixture.asOf,
  });

  assert.equal(result.status, "UNKNOWN");
  assert.ok(result.horizons.every((item) => item.status === "UNKNOWN"));
  assert.match(result.horizons[0].reason ?? "", /500-row limit/);
});

// RECOVERY-G1-03: 9 October 2026 GC=F close-referenced synthetic fixture.
// This is NOT a claim that these timestamps/quotes were read from Supabase.
function goldObservation(id: string, at: number, value: number): Observation {
  const base = observation({
    id,
    observedAt: new Date(at).toISOString(),
    retrievedAt: new Date(at + 10_000).toISOString(),
    value,
  });
  return {
    ...base,
    subject: "GC=F — COMEX Gold futures",
    sourceId: "yahoo-finance",
    identity: { ...base.identity!, seriesKey: "gold.futures.usd" },
    metadata: { ...base.metadata, metricId: "gold.futures.usd", symbol: "GC=F" },
  };
}

function goldNearFridayClose(jitter15mMs = 0): {
  rows: Observation[];
  target: Observation;
  asOf: string;
} {
  const from = Date.parse("2026-10-08T06:00:00.000Z");
  const targetAt = Date.parse("2026-10-09T20:55:00.000Z"); // Fri 16:55 EDT; closes at 17:00 ET
  const requested15mStart = targetAt - 15 * 60_000;
  const rows: Observation[] = [];
  for (let at = from, i = 0; at < targetAt; at += STEP_MS, i++) {
    if (cmeGlobexGoldSessionKey(at) === null) continue;
    const observedAt = at === requested15mStart ? at + jitter15mMs : at;
    rows.push(goldObservation("gc-" + i, observedAt, 4000 + i * 0.02));
  }
  const target = goldObservation("gc-friday-close", targetAt, 4090);
  rows.push(target);
  return { rows, target, asOf: new Date(targetAt + 60_000).toISOString() };
}

test("RECOVERY-G1-03 reuses COMEX regular Gold sessions including EDT/EST and Friday close", () => {
  const id = (time: string) => cmeGlobexGoldSessionKey(Date.parse(time));
  assert.equal(id("2026-10-09T20:55:00.000Z"), "2026-10-08");
  assert.equal(id("2026-10-09T21:00:00.000Z"), null);
  assert.equal(id("2026-10-10T16:00:00.000Z"), null);
  assert.equal(id("2026-10-11T21:59:59.000Z"), null);
  assert.equal(id("2026-10-11T22:00:00.000Z"), "2026-10-11");
  assert.equal(id("2026-10-12T00:00:00.000Z"), "2026-10-11");
  // November standard time: GC closes at 22:00 UTC and opens Sunday at 23:00 UTC.
  assert.equal(id("2026-11-06T21:55:00.000Z"), "2026-11-05");
  assert.equal(id("2026-11-06T22:00:00.000Z"), null);
  assert.equal(id("2026-11-08T23:00:00.000Z"), "2026-11-08");
});

test("RECOVERY-G1-03 qualifies all four GC=F horizons near 9 Oct close without cross-session calibration samples", async () => {
  const fixture = goldNearFridayClose();
  const lookup = new Map(fixture.rows.map((item) => [item.id, item]));
  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory(fixture.rows),
    seriesKey: "gold.futures.usd",
    targetEnd: fixture.target,
    asOf: fixture.asOf,
  });

  assert.deepEqual(result.horizons.map((item) => item.horizonMs / 60_000), [15, 30, 60, 120]);
  for (const horizon of result.horizons) {
    assert.ok(["MATERIAL_MOVE", "BELOW_MATERIALITY_THRESHOLD"].includes(horizon.status), horizon.reason);
    assert.ok(horizon.targetStartObservationId);
    assert.equal(horizon.alignmentErrorMs, 0);
    assert.ok(horizon.historicalSampleSize >= 120);
    assert.equal(cmeGlobexGoldSessionKey(Date.parse(horizon.targetStartObservedAt!)),
      cmeGlobexGoldSessionKey(Date.parse(horizon.targetEndObservedAt)));
    for (const sample of horizon.historicalSamples) {
      const start = lookup.get(sample.startObservationId)!;
      const end = lookup.get(sample.endObservationId)!;
      const session = cmeGlobexGoldSessionKey(Date.parse(end.observedAt));
      assert.ok(session !== null);
      assert.equal(cmeGlobexGoldSessionKey(Date.parse(start.observedAt)), session);
    }
  }
  assert.equal(result.causalAttribution, "NOT_EVALUATED");
});

test("RECOVERY-G1-03 rejects 117s near-close start misalignment; BTC 24/7 still keeps 60s limit", async () => {
  const gold = goldNearFridayClose(117_000);
  const r = await detectContinuousMarketMove({
    repository: new MemoryHistory(gold.rows), seriesKey: "gold.futures.usd",
    targetEnd: gold.target, asOf: gold.asOf,
  });
  assert.equal(r.horizons[0].status, "INSUFFICIENT_DATA");
  assert.equal(r.horizons[0].targetStartObservationId, undefined);
  assert.match(r.horizons[0].reason ?? "", /alignment tolerance/);

  const btc = regularHistory({ jitter15mStartMs: 117_000 });
  const btcResult = await detectContinuousMarketMove({
    repository: new MemoryHistory(btc.rows), seriesKey: "btc.spot.usd",
    targetEnd: btc.target, asOf: btc.asOf,
  });
  assert.equal(btcResult.horizons[0].status, "INSUFFICIENT_DATA");
});

test("RECOVERY-G1-03 rejects overnight Gold cross-break 120m pair without affecting BTC 24/7 pairing", async () => {
  const oldAt = Date.parse("2026-10-12T20:10:00.000Z"); // Mon 16:10 EDT, previous session
  const newAt = Date.parse("2026-10-12T22:10:00.000Z"); // Mon 18:10 EDT, new session
  const goldRows = [goldObservation("pre-maintenance", oldAt, 4000),
    goldObservation("post-maintenance", newAt, 4100)];
  const gold = await detectContinuousMarketMove({
    repository: new MemoryHistory(goldRows), seriesKey: "gold.futures.usd",
    targetEnd: goldRows[1], asOf: new Date(newAt + 60_000).toISOString(),
  });
  const twoHours = gold.horizons.find((item) => item.horizonMs === 120 * 60_000)!;
  assert.equal(twoHours.status, "INSUFFICIENT_DATA");
  assert.equal(twoHours.targetStartObservationId, undefined);

  const btcRows = [observation({ id: "pre-maintenance", observedAt: new Date(oldAt).toISOString(), value: 100 }),
    observation({ id: "post-maintenance", observedAt: new Date(newAt).toISOString(), value: 110 })];
  const btc = await detectContinuousMarketMove({
    repository: new MemoryHistory(btcRows), seriesKey: "btc.spot.usd",
    targetEnd: btcRows[1], asOf: new Date(newAt + 60_000).toISOString(),
  });
  assert.equal(btc.horizons.find((item) => item.horizonMs === 120 * 60_000)?.targetStartObservationId, "pre-maintenance");
});

test("RECOVERY-G1-03 marks Friday after-close GC=F targets incompatible, never infers a Gold move", async () => {
  const at = Date.parse("2026-10-09T21:05:00.000Z"); // Fri 17:05 ET, closed
  const target = goldObservation("closed-quote", at, 4095);
  const result = await detectContinuousMarketMove({
    repository: new MemoryHistory([target]), seriesKey: "gold.futures.usd",
    targetEnd: target, asOf: new Date(at + 60_000).toISOString(),
  });
  assert.equal(result.status, "INCOMPATIBLE");
  assert.ok(result.horizons.every((item) => item.status === "INCOMPATIBLE"));
});
