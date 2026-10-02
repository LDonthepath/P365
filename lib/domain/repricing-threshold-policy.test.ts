import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_REPRICING_THRESHOLDS_V1,
  PRODUCTION_REPRICING_UNAVAILABLE_V1,
  productionRepricingThresholdFor,
} from "./repricing-threshold-policy";

test("RPR-002B freezes only RPR-002A-eligible BTC and DXY P90 candidates", () => {
  assert.equal(PRODUCTION_REPRICING_THRESHOLDS_V1.length, 8);

  for (const entry of PRODUCTION_REPRICING_THRESHOLDS_V1) {
    assert.ok(entry.seriesKey === "btc.spot.usd" || entry.seriesKey === "dxy.index.usd");
    assert.equal(entry.threshold.basis, "ABSOLUTE_PERCENT_CHANGE");
    assert.equal(entry.threshold.minimumMagnitude, entry.calibration.p90);
    assert.equal(entry.calibration.percentile, 90);
    assert.ok(entry.calibration.sampleSize >= 100);
    assert.equal(entry.calibration.auditDate, "2026-10-02");
  }
});

test("RPR-002B keeps Gold explicitly unavailable instead of freezing weak-tail estimates", () => {
  assert.equal(PRODUCTION_REPRICING_UNAVAILABLE_V1.length, 4);
  assert.ok(
    PRODUCTION_REPRICING_UNAVAILABLE_V1.every(
      (entry) =>
        entry.seriesKey === "gold.futures.usd"
        && entry.status === "INSUFFICIENT_DATA",
    ),
  );
});

test("RPR-002B requires exact observation key, role, and horizon with no fallback", () => {
  const exact = productionRepricingThresholdFor({
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    afterRole: "T_PLUS_5",
    comparisonHorizonMs: 10 * 60 * 1000,
  });
  assert.deepEqual(exact, {
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    basis: "ABSOLUTE_PERCENT_CHANGE",
    minimumMagnitude: 0.226434,
  });

  assert.equal(
    productionRepricingThresholdFor({
      observationKey: "ASSET:btc.spot.usd:coingecko-market",
      afterRole: "T_PLUS_5",
      comparisonHorizonMs: 9 * 60 * 1000,
    }),
    null,
  );

  assert.equal(
    productionRepricingThresholdFor({
      observationKey: "ASSET:gold.futures.usd:yahoo-finance",
      afterRole: "T_PLUS_5",
      comparisonHorizonMs: 10 * 60 * 1000,
    }),
    null,
  );

  assert.equal(
    productionRepricingThresholdFor({
      observationKey: "ASSET:eth.spot.usd:coingecko-market",
      afterRole: "T_PLUS_5",
      comparisonHorizonMs: 10 * 60 * 1000,
    }),
    null,
  );
});
