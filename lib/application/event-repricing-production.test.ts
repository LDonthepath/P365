import assert from "node:assert/strict";
import test from "node:test";
import type { EventWindowSnapshotComparison } from "./snapshot-comparison";
import { resolveProductionRepricingThresholds } from "./event-repricing";

function comparison(
  afterRole: "T_PLUS_5" | "T_PLUS_15",
  afterObservedAt: string,
): EventWindowSnapshotComparison {
  return {
    windowId: "window-test",
    eventIdentityKey: "event:v1:US:test",
    beforeRole: "PRE",
    afterRole,
    beforeMatch: {
      status: "QUALIFIED",
      role: "PRE",
      phase: "BASELINE",
      targetAt: "2026-10-02T12:25:00.000Z",
      timingErrorMs: 0,
      snapshotQuality: "COMPLETE",
    },
    afterMatch: {
      status: "QUALIFIED",
      role: afterRole,
      phase: afterRole === "T_PLUS_5"
        ? "INITIAL_REACTION"
        : "EARLY_CONFIRMATION",
      targetAt: afterRole === "T_PLUS_5"
        ? "2026-10-02T12:35:00.000Z"
        : "2026-10-02T12:45:00.000Z",
      timingErrorMs: 0,
      snapshotQuality: "COMPLETE",
    },
    contaminationStatus: "CLEAN",
    contaminants: [],
    comparison: {
      id: "comparison-test",
      version: "v1",
      policy: "point-in-time-semantic-slot-comparison-v1",
      scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
      beforeSnapshotId: "snapshot-pre",
      afterSnapshotId: "snapshot-post",
      beforeCapturedAt: "2026-10-02T12:25:00.000Z",
      afterCapturedAt: afterRole === "T_PLUS_5"
        ? "2026-10-02T12:35:00.000Z"
        : "2026-10-02T12:45:00.000Z",
      elapsedMs: afterRole === "T_PLUS_5" ? 600_000 : 1_200_000,
      quality: "COMPLETE",
      observationChanges: [{
        key: "ASSET:btc.spot.usd:coingecko-market",
        status: "CHANGED",
        beforeObservationId: "btc-pre",
        afterObservationId: "btc-post",
        beforeValue: 85000,
        afterValue: 85300,
        absoluteDelta: 300,
        percentDelta: 0.35294117647058826,
        unit: "USD",
        frequency: null,
        beforeObservedAt: "2026-10-02T12:20:00.000Z",
        afterObservedAt,
        beforeQuality: "FRESH",
        afterQuality: "FRESH",
        evidenceIds: ["evidence-pre", "evidence-post"],
      }],
      eventReferenceChanges: [],
      baselineReferenceChanges: [],
      missingObservationIds: [],
    },
  };
}

test("Gate 3b resolves an RPR-002B threshold only for exact Observation horizon and role", () => {
  const exact = resolveProductionRepricingThresholds(
    comparison("T_PLUS_5", "2026-10-02T12:30:00.000Z"),
  );
  assert.deepEqual(exact, [{
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    basis: "ABSOLUTE_PERCENT_CHANGE",
    minimumMagnitude: 0.226434,
  }]);

  const offByTenSeconds = resolveProductionRepricingThresholds(
    comparison("T_PLUS_5", "2026-10-02T12:30:10.000Z"),
  );
  assert.deepEqual(offByTenSeconds, []);

  const wrongRole = resolveProductionRepricingThresholds(
    comparison("T_PLUS_15", "2026-10-02T12:30:00.000Z"),
  );
  assert.deepEqual(wrongRole, []);
});
