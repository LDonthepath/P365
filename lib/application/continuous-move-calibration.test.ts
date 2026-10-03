import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTINUOUS_MOVE_CALIBRATION_V1,
  continuousMoveCalibrationSeries,
} from "./continuous-move-calibration";

test("MOVE-001B freezes the production-supported continuous calibration", () => {
  const policy = CONTINUOUS_MOVE_CALIBRATION_V1;

  assert.equal(policy.methodologyId, "continuous-market-move-materiality-v1");
  assert.equal(policy.methodologyVersion, "v1");
  assert.equal(policy.transformation, "ABSOLUTE_PERCENT_CHANGE");
  assert.equal(policy.lookbackMs, 36 * 60 * 60 * 1000);
  assert.equal(policy.minimumSampleSize, 120);
  assert.equal(policy.materialityPercentile, 97.5);
  assert.equal(policy.alignmentToleranceMs, 60 * 1000);
  assert.deepEqual(policy.horizonsMs, [
    15 * 60 * 1000,
    30 * 60 * 1000,
    60 * 60 * 1000,
    120 * 60 * 1000,
  ]);
});

test("MOVE-001B remains bounded to BTC and Gold canonical source-qualified series", () => {
  assert.deepEqual(
    CONTINUOUS_MOVE_CALIBRATION_V1.series.map((series) => [
      series.seriesKey,
      series.sourceId,
    ]),
    [
      ["btc.spot.usd", "coingecko-market"],
      ["gold.futures.usd", "yahoo-finance"],
    ],
  );

  assert.equal(
    continuousMoveCalibrationSeries("btc.spot.usd").observationKey,
    "ASSET:btc.spot.usd:coingecko-market",
  );
  assert.equal(
    continuousMoveCalibrationSeries("gold.futures.usd").observationKey,
    "ASSET:gold.futures.usd:yahoo-finance",
  );
});
