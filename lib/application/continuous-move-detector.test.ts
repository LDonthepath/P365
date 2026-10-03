import assert from "node:assert/strict";
import test from "node:test";
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
