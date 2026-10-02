import assert from "node:assert/strict";
import test from "node:test";
import type { EventWindowRole } from "../domain/event-window";
import type { SnapshotObservationChange } from "../domain/snapshot-comparison";
import type { EventWindowSnapshotComparison } from "./snapshot-comparison";
import { buildTransmissionDirectionCalibration } from "./transmission-direction-calibration";

const DRIVER = "ASSET:dxy.index.usd:yahoo-finance";
const RESPONSE = "ASSET:btc.spot.usd:coingecko-market";

function change(input: {
  key: string;
  beforeId: string;
  afterId: string;
  percentDelta: number;
}): SnapshotObservationChange {
  return {
    key: input.key,
    status: input.percentDelta === 0 ? "UNCHANGED" : "CHANGED",
    beforeObservationId: input.beforeId,
    afterObservationId: input.afterId,
    beforeValue: 100,
    afterValue: 100 * (1 + input.percentDelta / 100),
    absoluteDelta: input.percentDelta,
    percentDelta: input.percentDelta,
    unit: input.key === DRIVER ? "INDEX" : "USD",
    frequency: "INTRADAY",
    beforeObservedAt: "2026-10-01T12:20:00.000Z",
    afterObservedAt: "2026-10-01T12:40:00.000Z",
    beforeQuality: "FRESH",
    afterQuality: "FRESH",
    evidenceIds: ["e-before", "e-after"],
  };
}

function comparison(input: {
  id: string;
  eventIdentityKey: string;
  role?: Exclude<EventWindowRole, "PRE">;
  driverPct?: number;
  responsePct?: number;
  driverBeforeId?: string;
  driverAfterId?: string;
  responseBeforeId?: string;
  responseAfterId?: string;
  quality?: "COMPLETE" | "PARTIAL" | "STALE" | "UNKNOWN";
}): EventWindowSnapshotComparison {
  const role = input.role ?? "T_PLUS_15";
  return {
    windowId: "window-" + input.id,
    eventIdentityKey: input.eventIdentityKey,
    beforeRole: "PRE",
    afterRole: role,
    beforeMatch: {
      status: "QUALIFIED",
      role: "PRE",
      phase: "BASELINE",
      targetAt: "2026-10-01T12:25:00.000Z",
      timingErrorMs: 0,
      snapshotQuality: "COMPLETE",
    },
    afterMatch: {
      status: "QUALIFIED",
      role,
      phase: role === "T_PLUS_5"
        ? "INITIAL_REACTION"
        : role === "T_PLUS_15"
          ? "EARLY_CONFIRMATION"
          : role === "T_PLUS_30"
            ? "FOLLOW_THROUGH"
            : "PERSISTENCE",
      targetAt: "2026-10-01T12:45:00.000Z",
      timingErrorMs: 0,
      snapshotQuality: input.quality ?? "COMPLETE",
    },
    contaminationStatus: "CLEAN",
    contaminants: [],
    comparison: {
      id: input.id,
      version: "v1",
      policy: "point-in-time-semantic-slot-comparison-v1",
      scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
      beforeSnapshotId: "before-" + input.id,
      afterSnapshotId: "after-" + input.id,
      beforeCapturedAt: "2026-10-01T12:25:00.000Z",
      afterCapturedAt: "2026-10-01T12:45:00.000Z",
      elapsedMs: 20 * 60 * 1000,
      quality: input.quality ?? "COMPLETE",
      observationChanges: [
        change({
          key: DRIVER,
          beforeId: input.driverBeforeId ?? "dxy-before",
          afterId: input.driverAfterId ?? "dxy-after",
          percentDelta: input.driverPct ?? 0.1,
        }),
        change({
          key: RESPONSE,
          beforeId: input.responseBeforeId ?? "btc-before",
          afterId: input.responseAfterId ?? "btc-after",
          percentDelta: input.responsePct ?? -0.2,
        }),
      ],
      eventReferenceChanges: [],
      baselineReferenceChanges: [],
      missingObservationIds: [],
    },
  };
}

test("TRN-002A collapses simultaneous event identities that share the same market lineage into one cohort", () => {
  const result = buildTransmissionDirectionCalibration({
    driverObservationKey: DRIVER,
    responseObservationKey: RESPONSE,
    afterRole: "T_PLUS_15",
    comparisons: [
      comparison({
        id: "cmp-cpi",
        eventIdentityKey: "event:cpi",
      }),
      comparison({
        id: "cmp-core-cpi",
        eventIdentityKey: "event:core-cpi",
      }),
    ],
  });

  assert.equal(result.audit.inputComparisonCount, 2);
  assert.equal(result.audit.directionalComparisonCount, 2);
  assert.equal(result.audit.uniqueCohortCount, 1);
  assert.equal(result.audit.duplicateCohortComparisonCount, 1);
  assert.equal(result.evidence.sampleSize, 1);
  assert.deepEqual(
    result.evidence.samples[0]?.comparisonIds,
    ["cmp-core-cpi", "cmp-cpi"],
  );
  assert.deepEqual(
    result.evidence.samples[0]?.eventIdentityKeys,
    ["event:core-cpi", "event:cpi"],
  );
});

test("TRN-002A excludes degraded and non-directional comparisons rather than fabricating relationship evidence", () => {
  const result = buildTransmissionDirectionCalibration({
    driverObservationKey: DRIVER,
    responseObservationKey: RESPONSE,
    afterRole: "T_PLUS_15",
    comparisons: [
      comparison({
        id: "cmp-valid",
        eventIdentityKey: "event:valid",
        driverBeforeId: "dxy-before-valid",
        driverAfterId: "dxy-after-valid",
        responseBeforeId: "btc-before-valid",
        responseAfterId: "btc-after-valid",
      }),
      comparison({
        id: "cmp-stale",
        eventIdentityKey: "event:stale",
        quality: "STALE",
        driverBeforeId: "dxy-before-stale",
        driverAfterId: "dxy-after-stale",
        responseBeforeId: "btc-before-stale",
        responseAfterId: "btc-after-stale",
      }),
      comparison({
        id: "cmp-flat",
        eventIdentityKey: "event:flat",
        responsePct: 0,
        driverBeforeId: "dxy-before-flat",
        driverAfterId: "dxy-after-flat",
        responseBeforeId: "btc-before-flat",
        responseAfterId: "btc-after-flat",
      }),
      comparison({
        id: "cmp-other-role",
        eventIdentityKey: "event:other",
        role: "T_PLUS_30",
        driverBeforeId: "dxy-before-other",
        driverAfterId: "dxy-after-other",
        responseBeforeId: "btc-before-other",
        responseAfterId: "btc-after-other",
      }),
    ],
  });

  assert.equal(result.audit.matchingRoleComparisonCount, 3);
  assert.equal(result.audit.completeComparisonCount, 2);
  assert.equal(result.audit.directionalComparisonCount, 1);
  assert.equal(result.audit.excludedQualityCount, 1);
  assert.equal(result.audit.excludedDirectionalCount, 1);
  assert.equal(result.audit.uniqueCohortCount, 1);
  assert.equal(result.evidence.status, "INSUFFICIENT_DATA");
});
