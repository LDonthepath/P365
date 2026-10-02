import assert from "node:assert/strict";
import test from "node:test";
import {
  calibrateTransmissionDirection,
  TRANSMISSION_DIRECTION_CALIBRATION_MIN_SAMPLE_SIZE_V1,
  TRANSMISSION_DIRECTION_CALIBRATION_SIGNIFICANCE_V1,
} from "./transmission-direction-calibration";

function sample(
  index: number,
  relation: "SAME_DIRECTION" | "OPPOSITE_DIRECTION",
) {
  return {
    sampleId: "sample-" + String(index).padStart(3, "0"),
    driverPercentChange: 0.1 + index / 10_000,
    responsePercentChange: relation === "SAME_DIRECTION"
      ? 0.2 + index / 10_000
      : -(0.2 + index / 10_000),
    comparisonIds: ["comparison-" + index],
    eventIdentityKeys: ["event-" + index],
  };
}

test("TRN-002A fails closed below 30 unique directional cohorts even with unanimous direction", () => {
  const result = calibrateTransmissionDirection({
    driverObservationKey: "ASSET:dxy.index.usd:yahoo-finance",
    responseObservationKey: "ASSET:btc.spot.usd:coingecko-market",
    afterRole: "T_PLUS_15",
    methodologyId: "intraday-event-window-directional-relationship-v1",
    methodologyVersion: "v1",
    samples: Array.from({ length: 8 }, (_, index) =>
      sample(index, "OPPOSITE_DIRECTION")),
  });

  assert.equal(TRANSMISSION_DIRECTION_CALIBRATION_MIN_SAMPLE_SIZE_V1, 30);
  assert.equal(
    TRANSMISSION_DIRECTION_CALIBRATION_SIGNIFICANCE_V1,
    0.05,
  );
  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.sampleSize, 8);
  assert.equal(result.oppositeDirectionCount, 8);
  assert.equal(result.candidateExpectedRelation, null);
  assert.equal(result.causalAttribution, "NOT_EVALUATED");
});

test("TRN-002A produces a candidate only when minimum sample and exact binomial significance both pass", () => {
  const result = calibrateTransmissionDirection({
    driverObservationKey: "ASSET:dxy.index.usd:yahoo-finance",
    responseObservationKey: "ASSET:btc.spot.usd:coingecko-market",
    afterRole: "T_PLUS_30",
    methodologyId: "intraday-event-window-directional-relationship-v1",
    methodologyVersion: "v1",
    samples: [
      ...Array.from({ length: 24 }, (_, index) =>
        sample(index, "OPPOSITE_DIRECTION")),
      ...Array.from({ length: 6 }, (_, index) =>
        sample(index + 24, "SAME_DIRECTION")),
    ],
  });

  assert.equal(result.status, "CANDIDATE");
  assert.equal(result.sampleSize, 30);
  assert.equal(result.oppositeDirectionCount, 24);
  assert.equal(result.sameDirectionCount, 6);
  assert.ok(
    result.exactTwoSidedPValue !== null
    && result.exactTwoSidedPValue <= 0.05,
  );
  assert.equal(result.candidateExpectedRelation, "OPPOSITE_DIRECTION");
});

test("TRN-002A refuses to freeze a direction when a sufficiently large sample remains statistically balanced", () => {
  const result = calibrateTransmissionDirection({
    driverObservationKey: "ASSET:dxy.index.usd:yahoo-finance",
    responseObservationKey: "ASSET:btc.spot.usd:coingecko-market",
    afterRole: "T_PLUS_60",
    methodologyId: "intraday-event-window-directional-relationship-v1",
    methodologyVersion: "v1",
    samples: [
      ...Array.from({ length: 15 }, (_, index) =>
        sample(index, "SAME_DIRECTION")),
      ...Array.from({ length: 15 }, (_, index) =>
        sample(index + 15, "OPPOSITE_DIRECTION")),
    ],
  });

  assert.equal(result.status, "NO_STABLE_RELATIONSHIP");
  assert.equal(result.sameDirectionCount, 15);
  assert.equal(result.oppositeDirectionCount, 15);
  assert.equal(result.exactTwoSidedPValue, 1);
  assert.equal(result.candidateExpectedRelation, null);
});

test("TRN-002A rejects duplicate statistical sample identity", () => {
  const duplicated = sample(1, "SAME_DIRECTION");
  assert.throws(
    () => calibrateTransmissionDirection({
      driverObservationKey: "ASSET:dxy.index.usd:yahoo-finance",
      responseObservationKey: "ASSET:btc.spot.usd:coingecko-market",
      afterRole: "T_PLUS_5",
      methodologyId: "intraday-event-window-directional-relationship-v1",
      methodologyVersion: "v1",
      samples: [duplicated, duplicated],
    }),
    /sample IDs must be unique/,
  );
});
