import {
  assessEventRepricing,
  EVENT_REPRICING_POLICY_V1,
  type EventRepricingInput,
  type EventRepricingThreshold,
} from "./event-repricing";
import type { EventWindowContaminant } from "./event-window";
import type {
  SnapshotComparison,
  SnapshotObservationChange,
} from "./snapshot-comparison";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label
      + "\nexpected: "
      + JSON.stringify(expected)
      + "\nactual: "
      + JSON.stringify(actual),
    );
  }
}

function assertThrows(label: string, fn: () => unknown): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(label + " expected an exception.");
  }
}

function change(input: {
  key: string;
  status?: SnapshotObservationChange["status"];
  before?: number | null;
  after?: number | null;
  absoluteDelta?: number | null;
  percentDelta?: number | null;
  unit?: string | null;
}): SnapshotObservationChange {
  const before = input.before ?? 100;
  const after = input.after ?? 101;
  return {
    key: input.key,
    status: input.status ?? "CHANGED",
    beforeObservationId: "before-" + input.key,
    afterObservationId: "after-" + input.key,
    beforeValue: before,
    afterValue: after,
    absoluteDelta: input.absoluteDelta === undefined ? 1 : input.absoluteDelta,
    percentDelta: input.percentDelta === undefined ? 1 : input.percentDelta,
    unit: input.unit === undefined ? "usd" : input.unit,
    frequency: "INTRADAY",
    beforeObservedAt: "2026-09-25T12:20:00.000Z",
    afterObservedAt: "2026-09-25T12:30:00.000Z",
    beforeQuality: "FRESH",
    afterQuality: "FRESH",
    evidenceIds: ["evidence-" + input.key],
  };
}

function comparison(
  observationChanges: SnapshotObservationChange[],
): SnapshotComparison {
  return {
    id: "snapshot-comparison-v1-test",
    version: "v1",
    policy: "point-in-time-semantic-slot-comparison-v1",
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    beforeSnapshotId: "snapshot-pre",
    afterSnapshotId: "snapshot-post",
    beforeCapturedAt: "2026-09-25T12:25:00.000Z",
    afterCapturedAt: "2026-09-25T12:35:00.000Z",
    elapsedMs: 600_000,
    quality: "COMPLETE",
    observationChanges,
    eventReferenceChanges: [],
    baselineReferenceChanges: [],
    missingObservationIds: [],
  };
}

const btcKey = "ASSET:btc.spot.usd:coingecko-market";
const dxyKey = "ASSET:dxy.index.usd:yahoo-finance";
const goldKey = "ASSET:gold.futures.usd:yahoo-finance";

const thresholds: EventRepricingThreshold[] = [
  {
    observationKey: dxyKey,
    basis: "ABSOLUTE_PERCENT_CHANGE",
    minimumMagnitude: 0.2,
  },
  {
    observationKey: btcKey,
    basis: "ABSOLUTE_PERCENT_CHANGE",
    minimumMagnitude: 0.5,
  },
];

function input(overrides: Partial<EventRepricingInput> = {}): EventRepricingInput {
  return {
    windowId: "event-window-v1-test",
    eventIdentityKey:
      "event:v1:US:2026-09-25T12:30:00.000Z:durable-goods-orders-mom",
    beforeRole: "PRE",
    afterRole: "T_PLUS_5",
    contaminationStatus: "CLEAN",
    contaminants: [],
    comparison: comparison([
      change({
        key: btcKey,
        before: 100,
        after: 101,
        absoluteDelta: 1,
        percentDelta: 1,
      }),
      change({
        key: dxyKey,
        before: 100,
        after: 100.05,
        absoluteDelta: 0.05,
        percentDelta: 0.05,
      }),
      change({
        key: goldKey,
        before: 100,
        after: 100.3,
        absoluteDelta: 0.3,
        percentDelta: 0.3,
      }),
    ]),
    thresholds,
    ...overrides,
  };
}

function main(): void {
  const assessed = assessEventRepricing(input());

  assertEqual(
    assessed.policy,
    EVENT_REPRICING_POLICY_V1,
    "policy is explicit",
  );
  assertEqual(
    assessed.status,
    "REPRICING_OBSERVED",
    "one configured threshold crossing qualifies repricing",
  );
  assertEqual(
    assessed.repricedObservationKeys,
    [btcKey],
    "only threshold-crossing configured keys are repriced",
  );
  assertEqual(
    assessed.unresolvedObservationKeys,
    [],
    "fully comparable configured keys resolve",
  );
  assertEqual(
    assessed.unconfiguredObservationKeys,
    [goldKey],
    "unconfigured comparison slots stay explicit",
  );
  assertEqual(
    assessed.responses.map((response) => [
      response.observationKey,
      response.status,
      response.direction,
      response.measuredMagnitude,
    ]),
    [
      [btcKey, "REPRICED", "UP", 1],
      [dxyKey, "BELOW_THRESHOLD", "UP", 0.05],
    ],
    "responses are deterministically sorted by observation key",
  );
  assertEqual(
    assessed.causalAttribution,
    "NOT_EVALUATED",
    "repricing does not infer event causality",
  );

  const reordered = assessEventRepricing(input({
    thresholds: [...thresholds].reverse(),
  }));
  assertEqual(
    reordered.id,
    assessed.id,
    "threshold input ordering does not alter deterministic identity",
  );

  const noCrossing = assessEventRepricing(input({
    thresholds: [
      {
        observationKey: btcKey,
        basis: "ABSOLUTE_PERCENT_CHANGE",
        minimumMagnitude: 2,
      },
      {
        observationKey: dxyKey,
        basis: "ABSOLUTE_PERCENT_CHANGE",
        minimumMagnitude: 0.2,
      },
    ],
  }));
  assertEqual(
    noCrossing.status,
    "NO_REPRICING_OBSERVED",
    "qualified below-threshold changes do not become repricing",
  );

  const absolute = assessEventRepricing(input({
    thresholds: [{
      observationKey: dxyKey,
      basis: "ABSOLUTE_CHANGE",
      minimumMagnitude: 0.04,
    }],
  }));
  assertEqual(
    absolute.responses[0]?.status,
    "REPRICED",
    "absolute-change policy is supported explicitly",
  );

  const unchanged = assessEventRepricing(input({
    comparison: comparison([
      change({
        key: btcKey,
        status: "UNCHANGED",
        before: 100,
        after: 100,
        absoluteDelta: 0,
        percentDelta: 0,
      }),
    ]),
    thresholds: [{
      observationKey: btcKey,
      basis: "ABSOLUTE_PERCENT_CHANGE",
      minimumMagnitude: 0.5,
    }],
  }));
  assertEqual(
    unchanged.status,
    "NO_REPRICING_OBSERVED",
    "unchanged qualified value is below threshold",
  );
  assertEqual(
    unchanged.responses[0]?.direction,
    "FLAT",
    "unchanged value direction is mechanical",
  );

  const missingConfiguredSlot = assessEventRepricing(input({
    thresholds: [{
      observationKey: "ASSET:missing",
      basis: "ABSOLUTE_PERCENT_CHANGE",
      minimumMagnitude: 0.1,
    }],
  }));
  assertEqual(
    missingConfiguredSlot.status,
    "INDETERMINATE",
    "missing configured slot fails closed",
  );
  assertEqual(
    missingConfiguredSlot.responses[0]?.status,
    "UNRESOLVED",
    "missing configured slot is explicit",
  );

  const incompatible = assessEventRepricing(input({
    comparison: comparison([
      change({
        key: btcKey,
        status: "INCOMPATIBLE",
        absoluteDelta: null,
        percentDelta: null,
      }),
    ]),
    thresholds: [{
      observationKey: btcKey,
      basis: "ABSOLUTE_PERCENT_CHANGE",
      minimumMagnitude: 0.5,
    }],
  }));
  assertEqual(
    incompatible.status,
    "INDETERMINATE",
    "incompatible canonical observations cannot become repricing",
  );

  const contaminant: EventWindowContaminant = {
    eventId: "event-contaminant",
    eventIdentityKey:
      "event:v1:US:2026-09-25T12:33:00.000Z:other-high-event",
    subject: "Other HIGH event",
    t0: "2026-09-25T12:33:00.000Z",
    t0Source: "SCHEDULED_AT",
  };
  const contaminated = assessEventRepricing(input({
    contaminationStatus: "CONTAMINATED",
    contaminants: [contaminant],
  }));
  assertEqual(
    contaminated.status,
    "CONTAMINATED",
    "intervening qualified HIGH event blocks clean repricing status",
  );
  assertEqual(
    contaminated.repricedObservationKeys,
    [btcKey],
    "measured threshold crossings remain visible under contamination",
  );
  assertEqual(
    contaminated.causalAttribution,
    "NOT_EVALUATED",
    "contamination never triggers causal attribution",
  );

  assertThrows(
    "thresholds cannot be empty",
    () => assessEventRepricing(input({ thresholds: [] })),
  );
  assertThrows(
    "unsupported threshold basis fails closed",
    () => assessEventRepricing(input({
      thresholds: [{
        observationKey: btcKey,
        basis: "UNSUPPORTED" as EventRepricingThreshold["basis"],
        minimumMagnitude: 0.5,
      }],
    })),
  );
  assertThrows(
    "threshold magnitude must be positive",
    () => assessEventRepricing(input({
      thresholds: [{
        observationKey: btcKey,
        basis: "ABSOLUTE_PERCENT_CHANGE",
        minimumMagnitude: 0,
      }],
    })),
  );
  assertThrows(
    "duplicate observation threshold keys are rejected",
    () => assessEventRepricing(input({
      thresholds: [
        {
          observationKey: btcKey,
          basis: "ABSOLUTE_PERCENT_CHANGE",
          minimumMagnitude: 0.5,
        },
        {
          observationKey: btcKey,
          basis: "ABSOLUTE_CHANGE",
          minimumMagnitude: 10,
        },
      ],
    })),
  );
  assertThrows(
    "contamination status cannot contradict evidence",
    () => assessEventRepricing(input({
      contaminationStatus: "CLEAN",
      contaminants: [contaminant],
    })),
  );
}

main();
