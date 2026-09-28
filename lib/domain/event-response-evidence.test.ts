import type { CrossAssetTransmissionAssessment } from "./cross-asset-transmission";
import type { EventRepricingAssessment } from "./event-repricing";
import type { EventSurpriseAssessment } from "./event-surprise";
import {
  buildEventResponseEvidenceBundle,
  EVENT_RESPONSE_EVIDENCE_POLICY_V1,
} from "./event-response-evidence";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label
      + ": expected "
      + JSON.stringify(expected)
      + ", got "
      + JSON.stringify(actual),
    );
  }
}

function assertThrows(label: string, fn: () => void): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(label + ": expected function to throw");
}

const eventIdentityKey =
  "event:v1:US:2026-10-15T12:30:00.000Z:cpi";
const windowId = "event-window-v1-test";
const comparisonId = "snapshot-comparison-v1-test";

function surprise(
  overrides: Partial<EventSurpriseAssessment> = {},
): EventSurpriseAssessment {
  return {
    id: "event-surprise-v1-test",
    version: "v1",
    policy: "point-in-time-factual-event-surprise-v1",
    status: "VALID",
    eventIdentityKey,
    sourceId: "biquote",
    releaseAt: "2026-10-15T12:30:00.000Z",
    asOf: "2026-10-15T12:35:00.000Z",
    expectedType: "FORECAST",
    baselineEventResultId: "forecast",
    actualEventResultId: "actual",
    expected: 2.8,
    actual: 2.5,
    unit: "%",
    period: "Sep 2026",
    absoluteSurprise: -0.3,
    percentSurprise: -10.714285714285714,
    relation: "BELOW_EXPECTATION",
    expectationRetrievedAt: "2026-10-15T12:20:00.000Z",
    actualRetrievedAt: "2026-10-15T12:31:00.000Z",
    evidenceIds: ["evidence-actual", "evidence-forecast"],
    causalAttribution: "NOT_EVALUATED",
    ...overrides,
  };
}

function repricing(
  overrides: Partial<EventRepricingAssessment> = {},
): EventRepricingAssessment {
  return {
    id: "event-repricing-v1-test",
    version: "v1",
    policy: "threshold-governed-event-window-repricing-v1",
    windowId,
    eventIdentityKey,
    beforeRole: "PRE",
    afterRole: "T_PLUS_5",
    comparisonId,
    beforeSnapshotId: "snapshot-pre",
    afterSnapshotId: "snapshot-t5",
    beforeCapturedAt: "2026-10-15T12:25:00.000Z",
    afterCapturedAt: "2026-10-15T12:35:00.000Z",
    quality: "COMPLETE",
    contaminationStatus: "CLEAN",
    contaminants: [],
    causalAttribution: "NOT_EVALUATED",
    status: "REPRICING_OBSERVED",
    thresholds: [],
    responses: [],
    repricedObservationKeys: [],
    unresolvedObservationKeys: [],
    unconfiguredObservationKeys: [],
    ...overrides,
  };
}

function transmission(
  overrides: Partial<CrossAssetTransmissionAssessment> = {},
): CrossAssetTransmissionAssessment {
  return {
    id: "cross-asset-transmission-v1-test",
    version: "v1",
    policy: "explicit-relationship-event-window-transmission-v1",
    repricingAssessmentId: "event-repricing-v1-test",
    comparisonId,
    windowId,
    eventIdentityKey,
    afterRole: "T_PLUS_5",
    quality: "COMPLETE",
    contaminationStatus: "CLEAN",
    causalAttribution: "NOT_EVALUATED",
    status: "COHERENT",
    rules: [],
    edges: [],
    coherentRuleIds: [],
    divergentRuleIds: [],
    responseBelowThresholdRuleIds: [],
    driverNotRepricedRuleIds: [],
    unresolvedRuleIds: [],
    ...overrides,
  };
}

function main(): void {
  const bundle = buildEventResponseEvidenceBundle({
    surprise: surprise(),
    repricing: repricing(),
    transmission: transmission(),
  });

  assertEqual(
    bundle.policy,
    EVENT_RESPONSE_EVIDENCE_POLICY_V1,
    "policy is explicit",
  );
  assertEqual(
    bundle.eventIdentityKey,
    eventIdentityKey,
    "shared Event identity is retained",
  );
  assertEqual(
    bundle.knowledgeAt,
    "2026-10-15T12:35:00.000Z",
    "post-event Snapshot timestamp owns the shared knowledge cutoff",
  );
  assertEqual(
    bundle.causalAttribution,
    "NOT_EVALUATED",
    "bundle does not introduce causality",
  );

  const repeat = buildEventResponseEvidenceBundle({
    surprise: surprise(),
    repricing: repricing(),
    transmission: transmission(),
  });
  assertEqual(
    repeat.id,
    bundle.id,
    "equivalent evidence chain has deterministic identity",
  );

  assertThrows(
    "mismatched Event identity is rejected",
    () => buildEventResponseEvidenceBundle({
      surprise: surprise({ eventIdentityKey: "event:v1:US:other" }),
      repricing: repricing(),
      transmission: transmission(),
    }),
  );

  assertThrows(
    "SUR knowledge cutoff must match post-event Snapshot",
    () => buildEventResponseEvidenceBundle({
      surprise: surprise({ asOf: "2026-10-15T12:36:00.000Z" }),
      repricing: repricing(),
      transmission: transmission(),
    }),
  );

  assertThrows(
    "TRN must reference supplied RPR assessment",
    () => buildEventResponseEvidenceBundle({
      surprise: surprise(),
      repricing: repricing(),
      transmission: transmission({
        repricingAssessmentId: "event-repricing-v1-other",
      }),
    }),
  );

  assertThrows(
    "TRN and RPR must share the same post-event role",
    () => buildEventResponseEvidenceBundle({
      surprise: surprise(),
      repricing: repricing(),
      transmission: transmission({ afterRole: "T_PLUS_15" }),
    }),
  );

  assertThrows(
    "knowledge cutoff cannot precede qualified release",
    () => buildEventResponseEvidenceBundle({
      surprise: surprise({
        releaseAt: "2026-10-15T12:40:00.000Z",
      }),
      repricing: repricing(),
      transmission: transmission(),
    }),
  );
}

main();
