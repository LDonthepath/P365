import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";
import type {
  ContinuousMoveAssessment,
  ContinuousMoveHistoricalSample,
  ContinuousMoveHorizonAssessment,
} from "./continuous-move-detector";
import {
  calibrateMaterialMoveCrossAssetRelationships,
} from "./material-move-cross-asset-calibration";

const MINUTE_MS = 60 * 1000;
const HORIZON_MS = 15 * MINUTE_MS;
const AS_OF = "2026-10-07T10:00:00.000Z";
const START_MS = Date.parse("2026-10-05T00:00:00.000Z");

type Series = {
  seriesKey: string;
  sourceId: string;
  prefix: string;
};

const BTC: Series = { seriesKey: "btc.spot.usd", sourceId: "coingecko-market", prefix: "btc" };
const GOLD: Series = { seriesKey: "gold.futures.usd", sourceId: "yahoo-finance", prefix: "gold" };
const COMPANIONS: Series[] = [
  { seriesKey: "eth.spot.usd", sourceId: "coingecko-market", prefix: "eth" },
  { seriesKey: "dxy.index.usd", sourceId: "yahoo-finance", prefix: "dxy" },
  GOLD,
  { seriesKey: "fx.usdjpy.jpy_per_usd", sourceId: "yahoo-finance", prefix: "usdjpy" },
  { seriesKey: "fx.usdcnh.cnh_per_usd", sourceId: "yahoo-finance", prefix: "usdcnh" },
];

function observation(
  series: Series,
  index: number,
  observedAt: string,
  value: number,
): Observation {
  return {
    id: `${series.prefix}-${index}`,
    domain: "ASSET",
    subject: series.seriesKey,
    value: value.toFixed(8),
    observedAt,
    retrievedAt: new Date(Date.parse(observedAt) + 30_000).toISOString(),
    sourceId: series.sourceId,
    quality: "FRESH",
    evidenceId: `e-${series.prefix}-${index}`,
    identity: {
      version: "v1",
      seriesKey: series.seriesKey,
      measurementId: `m-${series.prefix}-${index}`,
      revisionFingerprint: `r-${series.prefix}-${index}`,
    },
  };
}

class MemoryHistory implements HistoricalObservationRepository {
  constructor(private readonly rows: Observation[]) {}

  async findHistory(
    query: Parameters<HistoricalObservationRepository["findHistory"]>[0],
  ): Promise<Observation[]> {
    const rows = this.rows
      .filter((row) =>
        row.domain === query.identity.domain
        && row.identity?.seriesKey === query.identity.seriesKey
        && (!query.sourceId || row.sourceId === query.sourceId)
        && (!query.observedAtOnOrAfter || row.observedAt >= query.observedAtOnOrAfter)
        && (!query.observedAtOnOrBefore || row.observedAt <= query.observedAtOnOrBefore)
        && (!query.retrievedAtOnOrBefore || row.retrievedAt <= query.retrievedAtOnOrBefore))
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    return rows.slice(0, query.limit);
  }
}

function buildSeries(
  series: Series,
  returns: number[],
): Observation[] {
  const rows: Observation[] = [];
  let value = 100;
  rows.push(
    observation(series, 0, new Date(START_MS).toISOString(), value),
  );

  for (let index = 0; index < returns.length; index += 1) {
    value *= 1 + returns[index] / 100;
    rows.push(
      observation(
        series,
        index + 1,
        new Date(START_MS + (index + 1) * HORIZON_MS).toISOString(),
        value,
      ),
    );
  }
  return rows;
}

function returns(): number[] {
  return Array.from({ length: 120 }, (_, index) => {
    const magnitude = 0.08 + (index % 9) * 0.015;
    return index % 4 < 2 ? magnitude : -magnitude;
  });
}

function historicalSamples(
  target: Series,
  targetReturns: number[],
): ContinuousMoveHistoricalSample[] {
  return targetReturns.map((value, index) => ({
    startObservationId: `${target.prefix}-${index}`,
    endObservationId: `${target.prefix}-${index + 1}`,
    endObservedAt: new Date(START_MS + (index + 1) * HORIZON_MS).toISOString(),
    magnitudePercent: Math.abs(value),
  }));
}

function materialHorizon(
  target: Series,
  targetReturns: number[],
): ContinuousMoveHorizonAssessment {
  return {
    horizonMs: HORIZON_MS,
    status: "MATERIAL_MOVE",
    targetStartObservationId: `${target.prefix}-current-start`,
    targetEndObservationId: `${target.prefix}-current-end`,
    targetStartObservedAt: "2026-10-07T09:45:00.000Z",
    targetEndObservedAt: "2026-10-07T10:00:00.000Z",
    alignmentErrorMs: 0,
    direction: "UP",
    signedPercentChange: 1.2,
    magnitudePercent: 1.2,
    materialityThresholdPercent: 0.9,
    targetPercentileRank: 99,
    historicalSampleSize: targetReturns.length,
    historicalSamples: historicalSamples(target, targetReturns),
  };
}

function assessment(
  target: Series,
  targetReturns: number[],
  status: ContinuousMoveAssessment["status"] = "MATERIAL_MOVE",
): ContinuousMoveAssessment {
  return {
    id: `move-${target.prefix}`,
    version: "v1",
    policy: "continuous-market-move-detector-v1",
    methodologyId: "continuous-market-move-materiality-v1",
    methodologyVersion: "v1",
    seriesKey: target.seriesKey as ContinuousMoveAssessment["seriesKey"],
    sourceId: target.sourceId,
    asOf: AS_OF,
    targetEndObservationId: `${target.prefix}-current-end`,
    targetEndObservedAt: "2026-10-07T10:00:00.000Z",
    status,
    hasMaterialMove: status === "MATERIAL_MOVE",
    horizons: status === "MATERIAL_MOVE"
      ? [materialHorizon(target, targetReturns)]
      : [{
          ...materialHorizon(target, targetReturns),
          status: "BELOW_MATERIALITY_THRESHOLD",
        }],
    causalAttribution: "NOT_EVALUATED",
  };
}

test("REL-002A measures same-horizon BTC cross-asset calibration without directional qualification", async () => {
  const targetReturns = returns();
  const rows = [
    ...buildSeries(BTC, targetReturns),
    ...COMPANIONS.flatMap((series, companionIndex) =>
      buildSeries(
        series,
        targetReturns.map((value) => value * (0.4 + companionIndex * 0.1)),
      )),
  ];

  const result = await calibrateMaterialMoveCrossAssetRelationships({
    assessment: assessment(BTC, targetReturns),
    repository: new MemoryHistory(rows),
  });

  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;

  assert.equal(result.calibration.pairs.length, 5);
  assert.equal(result.calibration.methodology.minimumSampleSize, 120);
  assert.equal(result.calibration.methodology.relationshipThreshold, "NOT_DEFINED");
  assert.equal(result.calibration.directionalQualification, "NOT_EVALUATED");
  assert.equal(result.calibration.causalAttribution, "NOT_EVALUATED");
  assert.equal(result.calibration.writesPerformed, false);

  for (const pair of result.calibration.pairs) {
    assert.equal(pair.status, "MEASURED");
    assert.equal(pair.pairedSampleSize, 120);
    assert.equal(pair.sameDirectionCount, 120);
    assert.equal(pair.oppositeDirectionCount, 0);
    assert.equal(pair.sameDirectionShare, 1);
    assert.ok(pair.correlation !== null);
    assert.ok(Math.abs(pair.correlation - 1) < 1e-10);
  }
});

test("REL-002A fails one companion closed when synchronous history is missing", async () => {
  const targetReturns = returns();
  const rows = [
    ...buildSeries(BTC, targetReturns),
    ...COMPANIONS
      .filter((series) => series.seriesKey !== "fx.usdcnh.cnh_per_usd")
      .flatMap((series) => buildSeries(series, targetReturns.map((value) => value * 0.5))),
  ];

  const result = await calibrateMaterialMoveCrossAssetRelationships({
    assessment: assessment(BTC, targetReturns),
    repository: new MemoryHistory(rows),
  });

  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;

  const usdcnh = result.calibration.pairs.find(
    (pair) => pair.companionSeriesKey === "fx.usdcnh.cnh_per_usd",
  );
  assert.ok(usdcnh);
  assert.equal(usdcnh.status, "INSUFFICIENT_DATA");
  assert.equal(usdcnh.pairedSampleSize, 0);
  assert.equal(usdcnh.correlation, null);

  assert.equal(
    result.calibration.pairs.filter((pair) => pair.status === "MEASURED").length,
    4,
  );
});

test("REL-002A calibrates the bounded Gold companion universe separately", async () => {
  const targetReturns = returns();
  const goldCompanions = [
    { seriesKey: "dxy.index.usd", sourceId: "yahoo-finance", prefix: "dxy" },
    BTC,
    { seriesKey: "fx.usdjpy.jpy_per_usd", sourceId: "yahoo-finance", prefix: "usdjpy" },
    { seriesKey: "fx.usdcnh.cnh_per_usd", sourceId: "yahoo-finance", prefix: "usdcnh" },
  ];
  const rows = [
    ...buildSeries(GOLD, targetReturns),
    ...goldCompanions.flatMap((series, index) =>
      buildSeries(series, targetReturns.map((value) => value * (0.5 + index * 0.1))),
    ),
  ];

  const result = await calibrateMaterialMoveCrossAssetRelationships({
    assessment: assessment(GOLD, targetReturns),
    repository: new MemoryHistory(rows),
  });

  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.deepEqual(
    result.calibration.pairs.map((pair) => pair.companionSeriesKey),
    [
      "btc.spot.usd",
      "dxy.index.usd",
      "fx.usdcnh.cnh_per_usd",
      "fx.usdjpy.jpy_per_usd",
    ],
  );
});

test("REL-002A does not run without a material MOVE trigger", async () => {
  const targetReturns = returns();
  const result = await calibrateMaterialMoveCrossAssetRelationships({
    assessment: assessment(BTC, targetReturns, "BELOW_MATERIALITY_THRESHOLD"),
    repository: new MemoryHistory([]),
  });

  assert.equal(result.status, "NOT_TRIGGERED");
});
