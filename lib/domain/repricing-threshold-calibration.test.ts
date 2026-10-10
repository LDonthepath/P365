import assert from "node:assert/strict";
import test from "node:test";
import type { HistoricalBaselineEvidence } from "./historical-baseline";
import {
  calibrateRepricingThresholdCandidate,
  REPRICING_CALIBRATION_MIN_SAMPLE_SIZE_V1,
} from "./repricing-threshold-calibration";

function baseline(values: number[], overrides: Partial<HistoricalBaselineEvidence> = {}): HistoricalBaselineEvidence {
  const samples = values.map((value, index) => ({
    observedAt: new Date(Date.parse("2026-10-01T00:00:00.000Z") + index * 600_000).toISOString(),
    startObservationId: `start-${index}`,
    endObservationId: `end-${index}`,
    value,
  }));
  return {
    id: "historical-baseline-test",
    version: "v1",
    policy: "point-in-time-historical-baseline-v1",
    status: "VALID",
    methodology: {
      methodologyId: "intraday-event-magnitude-historical-context-v1",
      methodologyVersion: "v1",
      identity: { domain: "ASSET", seriesKey: "btc.spot.usd" },
      sourceId: "coingecko-market",
      transformation: "ABSOLUTE_PERCENT_CHANGE",
      observedAtOnOrAfter: "2026-09-30T00:00:00.000Z",
      observedAtOnOrBefore: "2026-10-01T23:59:59.999Z",
      asOf: "2026-10-02T00:00:00.000Z",
      minimumSampleSize: 30,
      comparisonHorizonMs: 600_000,
    },
    targetObservationIds: ["target-start", "target-end"],
    targetObservationQualities: ["FRESH", "FRESH"],
    targetValue: 0.2,
    sampleSize: samples.length,
    samples,
    minimum: values.length ? Math.min(...values) : undefined,
    maximum: values.length ? Math.max(...values) : undefined,
    median: values.length ? values[Math.floor(values.length / 2)] : undefined,
    percentileRank: 50,
    ...overrides,
  };
}

function assertNear(actual: number | null, expected: number): void {
  // percentile_cont-style interpolation can differ by a few binary64 ULPs.
  const tolerance = 4 * Number.EPSILON * Math.max(1, Math.abs(expected));
  assert.ok(
    actual !== null && Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `expected interpolated percentile near ${expected} (tolerance ${tolerance}), got ${actual}`,
  );
}

test("RPR-002A derives a P90 candidate only from at least 100 qualified samples", () => {
  const values = Array.from({ length: 100 }, (_, index) => index + 1);
  const result = calibrateRepricingThresholdCandidate({
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    comparisonHorizonMs: 600_000,
    historicalBaseline: baseline(values),
  });

  assert.equal(REPRICING_CALIBRATION_MIN_SAMPLE_SIZE_V1, 100);
  assert.equal(result.status, "CANDIDATE");
  assertNear(result.p50, 50.5);
  assertNear(result.p75, 75.25);
  assertNear(result.p90, 90.1);
  assertNear(result.p95, 95.05);
  assert.deepEqual(result.candidateThreshold, {
    basis: "ABSOLUTE_PERCENT_CHANGE",
    percentile: 90,
    minimumMagnitude: result.p90,
  });
  assertNear(result.candidateThreshold?.minimumMagnitude ?? null, 90.1);
  assert.equal(result.causalAttribution, "NOT_EVALUATED");
});

test("RPR-002A P90 interpolates empirical values regardless of sample order", () => {
  const values = Array.from({ length: 100 }, (_, index) => ((index + 1) ** 2) / 100);
  const input = {
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    comparisonHorizonMs: 600_000,
  };
  const ascending = calibrateRepricingThresholdCandidate({
    ...input,
    historicalBaseline: baseline(values),
  });
  const descending = calibrateRepricingThresholdCandidate({
    ...input,
    historicalBaseline: baseline([...values].reverse()),
  });

  assert.equal(ascending.status, "CANDIDATE");
  assert.equal(descending.status, "CANDIDATE");
  // For 100 values, P90 interpolates between positions 90 and 91 at weight 0.1.
  assertNear(ascending.p90, 81.181);
  assertNear(descending.p90, 81.181);
  assert.equal(ascending.p90, descending.p90);
  assert.equal(ascending.candidateThreshold?.minimumMagnitude, ascending.p90);
  assert.equal(descending.candidateThreshold?.minimumMagnitude, descending.p90);
});

test("RPR-002A fails closed below 100 exact-horizon samples", () => {
  const values = Array.from({ length: 99 }, (_, index) => (index + 1) / 100);
  const result = calibrateRepricingThresholdCandidate({
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    comparisonHorizonMs: 600_000,
    historicalBaseline: baseline(values),
  });

  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.candidateThreshold, null);
  assert.equal(result.p90, null);
});

test("RPR-002A rejects non-magnitude transformations", () => {
  const values = Array.from({ length: 100 }, (_, index) => index + 1);
  const incompatible = baseline(values);
  incompatible.methodology = {
    ...incompatible.methodology,
    transformation: "PERCENT_CHANGE",
  };

  const result = calibrateRepricingThresholdCandidate({
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    comparisonHorizonMs: 600_000,
    historicalBaseline: incompatible,
  });

  assert.equal(result.status, "INCOMPATIBLE");
  assert.equal(result.candidateThreshold, null);
});

test("RPR-002A requires exact series/source/horizon lineage", () => {
  const values = Array.from({ length: 100 }, (_, index) => index + 1);
  const result = calibrateRepricingThresholdCandidate({
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    comparisonHorizonMs: 1_200_000,
    historicalBaseline: baseline(values),
  });

  assert.equal(result.status, "INCOMPATIBLE");
  assert.equal(result.candidateThreshold, null);
});
