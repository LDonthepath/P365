import assert from "node:assert/strict";
import test from "node:test";
import type { HistoricalObservationRepository } from "../repositories/types";
import type { MaterialMoveCrossAssetCalibration } from "./material-move-cross-asset-calibration";
import {
  buildMaterialMoveCrossAssetDiagnostic,
  compactMaterialMoveCrossAssetCalibration,
} from "./material-move-cross-asset-diagnostic";

const emptyHistory: HistoricalObservationRepository = {
  async findHistory() {
    return [];
  },
};

test("REL-002A diagnostic fails closed when no durable target observation exists", async () => {
  const result = await buildMaterialMoveCrossAssetDiagnostic({
    asset: "BTC",
    observations: emptyHistory,
    asOf: "2026-10-07T11:00:00.000Z",
  });

  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.asset, "BTC");
  assert.equal(result.seriesKey, "btc.spot.usd");
});

test("REL-002A diagnostic compacts samples out of the dashboard payload", () => {
  const calibration = {
    id: "rel-002a-fixture",
    version: "v1",
    policy: "material-move-cross-asset-relationship-calibration-v1",
    moveAssessmentId: "move-1",
    targetSeriesKey: "btc.spot.usd",
    asOf: "2026-10-07T11:00:00.000Z",
    methodology: {
      transformation: "SIGNED_PERCENT_CHANGE",
      historicalWindowMs: 36 * 60 * 60_000,
      moveReferenceMinimumSampleSize: 120,
      alignmentToleranceMs: 120_000,
      relationshipThreshold: "NOT_DEFINED",
      statisticalSufficiency: "NOT_EVALUATED",
      sampleIndependence: "NOT_EVALUATED",
    },
    pairs: [{
      targetSeriesKey: "btc.spot.usd",
      companionSeriesKey: "dxy.index.usd",
      horizonMs: 60 * 60_000,
      status: "OBSERVED",
      moveReferenceMinimumSampleSize: 120,
      sourceHistoricalSampleSize: 120,
      pairedSampleSize: 84,
      unpairedSampleSize: 36,
      pairedCoverageRatio: 0.7,
      targetIntervalOverlapCount: 72,
      targetIntervalOverlapShare: 0.6,
      statisticalSufficiency: "NOT_EVALUATED",
      sampleIndependence: "NOT_EVALUATED",
      coverageLossAttribution: "NOT_EVALUATED",
      sameDirectionCount: 32,
      oppositeDirectionCount: 52,
      flatCount: 0,
      sameDirectionShare: 32 / 84,
      correlation: -0.31,
      alignmentToleranceMs: 120_000,
      samples: [{
        targetStartObservationId: "btc-a",
        targetEndObservationId: "btc-b",
        companionStartObservationId: "dxy-a",
        companionEndObservationId: "dxy-b",
        targetStartObservedAt: "2026-10-06T10:00:00.000Z",
        targetEndObservedAt: "2026-10-06T11:00:00.000Z",
        companionStartObservedAt: "2026-10-06T10:00:00.000Z",
        companionEndObservedAt: "2026-10-06T11:00:00.000Z",
        targetSignedPercentChange: 1,
        companionSignedPercentChange: -0.2,
        alignment: "OPPOSITE_DIRECTION",
      }],
      reason: null,
      causalAttribution: "NOT_EVALUATED",
    }],
    causalAttribution: "NOT_EVALUATED",
    directionalQualification: "NOT_EVALUATED",
    writesPerformed: false,
  } satisfies MaterialMoveCrossAssetCalibration;

  const pairs = compactMaterialMoveCrossAssetCalibration(calibration);

  assert.deepEqual(pairs, [{
    horizonMinutes: 60,
    companionSeriesKey: "dxy.index.usd",
    status: "OBSERVED",
    sourceHistoricalSampleSize: 120,
    pairedSampleSize: 84,
    unpairedSampleSize: 36,
    pairedCoverageRatio: 0.7,
    targetIntervalOverlapShare: 0.6,
    sameDirectionShare: 32 / 84,
    correlation: -0.31,
  }]);
  assert.equal("samples" in pairs[0], false);
});
