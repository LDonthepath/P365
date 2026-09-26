import {
  assessCrossAssetTransmission,
  CROSS_ASSET_TRANSMISSION_POLICY_V1,
  type CrossAssetTransmissionInput,
  type CrossAssetTransmissionRuleInput,
} from "./cross-asset-transmission";
import type {
  EventRepricingAssessment,
  EventRepricingResponse,
} from "./event-repricing";

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

const dxyKey = "ASSET:dxy.index.usd:yahoo-finance";
const btcKey = "ASSET:btc.spot.usd:coingecko-market";
const goldKey = "ASSET:gold.futures.usd:yahoo-finance";

function response(input: {
  key: string;
  status?: EventRepricingResponse["status"];
  direction?: EventRepricingResponse["direction"];
  magnitude?: number | null;
}): EventRepricingResponse {
  return {
    observationKey: input.key,
    status: input.status ?? "REPRICED",
    direction: input.direction ?? "UP",
    basis: "ABSOLUTE_PERCENT_CHANGE",
    minimumMagnitude: 0.1,
    measuredMagnitude: input.magnitude === undefined ? 0.5 : input.magnitude,
    beforeValue: 100,
    afterValue: input.direction === "DOWN" ? 99 : 101,
    absoluteDelta: input.direction === "DOWN" ? -1 : 1,
    percentDelta: input.direction === "DOWN" ? -1 : 1,
    unit: "index",
    frequency: "INTRADAY",
  };
}

function repricing(
  overrides: Partial<EventRepricingAssessment> = {},
): EventRepricingAssessment {
  return {
    id: "event-repricing-v1-test",
    version: "v1",
    policy: "threshold-governed-event-window-repricing-v1",
    windowId: "event-window-v1-test",
    eventIdentityKey:
      "event:v1:US:2026-09-25T12:30:00.000Z:durable-goods-orders-mom",
    beforeRole: "PRE",
    afterRole: "T_PLUS_5",
    comparisonId: "snapshot-comparison-v1-test",
    beforeSnapshotId: "snapshot-pre",
    afterSnapshotId: "snapshot-post",
    beforeCapturedAt: "2026-09-25T12:25:00.000Z",
    afterCapturedAt: "2026-09-25T12:35:00.000Z",
    quality: "COMPLETE",
    contaminationStatus: "CLEAN",
    contaminants: [],
    causalAttribution: "NOT_EVALUATED",
    status: "REPRICING_OBSERVED",
    thresholds: [],
    responses: [
      response({ key: dxyKey, direction: "DOWN" }),
      response({ key: btcKey, direction: "UP" }),
      response({ key: goldKey, direction: "UP" }),
    ],
    repricedObservationKeys: [btcKey, dxyKey, goldKey].sort(),
    unresolvedObservationKeys: [],
    unconfiguredObservationKeys: [],
    ...overrides,
  };
}

const rules: CrossAssetTransmissionRuleInput[] = [
  {
    driverObservationKey: dxyKey,
    responseObservationKey: btcKey,
    expectedRelation: "OPPOSITE_DIRECTION",
    methodologyId: "event-window-directional-relation",
    methodologyVersion: "v1",
  },
  {
    driverObservationKey: dxyKey,
    responseObservationKey: goldKey,
    expectedRelation: "OPPOSITE_DIRECTION",
    methodologyId: "event-window-directional-relation",
    methodologyVersion: "v1",
  },
];

function input(
  overrides: Partial<CrossAssetTransmissionInput> = {},
): CrossAssetTransmissionInput {
  return {
    repricing: repricing(),
    rules,
    ...overrides,
  };
}

function main(): void {
  const coherent = assessCrossAssetTransmission(input());
  assertEqual(
    coherent.policy,
    CROSS_ASSET_TRANSMISSION_POLICY_V1,
    "policy is explicit",
  );
  assertEqual(
    coherent.status,
    "COHERENT",
    "all qualified edges matching explicit relations are coherent",
  );
  assertEqual(
    coherent.edges.map((edge) => edge.status),
    ["COHERENT", "COHERENT"],
    "both explicit DXY response rules resolve coherently",
  );
  assertEqual(
    coherent.causalAttribution,
    "NOT_EVALUATED",
    "coherent transmission evidence is not a causal claim",
  );

  const reordered = assessCrossAssetTransmission(input({
    rules: [...rules].reverse(),
  }));
  assertEqual(
    reordered.id,
    coherent.id,
    "rule ordering is non-semantic for deterministic identity",
  );

  const divergent = assessCrossAssetTransmission(input({
    repricing: repricing({
      responses: [
        response({ key: dxyKey, direction: "UP" }),
        response({ key: btcKey, direction: "UP" }),
        response({ key: goldKey, direction: "UP" }),
      ],
    }),
  }));
  assertEqual(
    divergent.status,
    "DIVERGENT",
    "qualified responses that oppose the explicit relationship are divergent",
  );

  const noResponse = assessCrossAssetTransmission(input({
    repricing: repricing({
      responses: [
        response({ key: dxyKey, direction: "DOWN" }),
        response({
          key: btcKey,
          status: "BELOW_THRESHOLD",
          direction: "UP",
          magnitude: 0.05,
        }),
        response({
          key: goldKey,
          status: "BELOW_THRESHOLD",
          direction: "UP",
          magnitude: 0.03,
        }),
      ],
      repricedObservationKeys: [dxyKey],
    }),
  }));
  assertEqual(
    noResponse.status,
    "NO_RESPONSE_REPRICING",
    "driver repricing without threshold-qualified responses remains explicit",
  );

  const mixed = assessCrossAssetTransmission(input({
    repricing: repricing({
      responses: [
        response({ key: dxyKey, direction: "DOWN" }),
        response({ key: btcKey, direction: "UP" }),
        response({
          key: goldKey,
          status: "BELOW_THRESHOLD",
          direction: "UP",
          magnitude: 0.03,
        }),
      ],
    }),
  }));
  assertEqual(
    mixed.status,
    "MIXED",
    "coherent and below-threshold response evidence is mixed",
  );

  const noDriver = assessCrossAssetTransmission(input({
    repricing: repricing({
      status: "NO_REPRICING_OBSERVED",
      responses: [
        response({
          key: dxyKey,
          status: "BELOW_THRESHOLD",
          direction: "DOWN",
          magnitude: 0.02,
        }),
        response({ key: btcKey, direction: "UP" }),
        response({ key: goldKey, direction: "UP" }),
      ],
      repricedObservationKeys: [btcKey, goldKey],
    }),
  }));
  assertEqual(
    noDriver.status,
    "INDETERMINATE",
    "a relationship cannot qualify without driver repricing",
  );
  assertEqual(
    noDriver.driverNotRepricedRuleIds.length,
    2,
    "all rules expose the unqualified driver",
  );

  const unresolved = assessCrossAssetTransmission(input({
    rules: [{
      driverObservationKey: dxyKey,
      responseObservationKey: "ASSET:missing",
      expectedRelation: "OPPOSITE_DIRECTION",
      methodologyId: "event-window-directional-relation",
      methodologyVersion: "v1",
    }],
  }));
  assertEqual(
    unresolved.status,
    "INDETERMINATE",
    "missing repricing response fails closed",
  );
  assertEqual(
    unresolved.edges[0]?.status,
    "UNRESOLVED",
    "missing relationship input remains explicit",
  );

  const degraded = assessCrossAssetTransmission(input({
    repricing: repricing({ quality: "PARTIAL" }),
  }));
  assertEqual(
    degraded.status,
    "INDETERMINATE",
    "degraded point-in-time comparison cannot produce clean transmission",
  );

  const contaminated = assessCrossAssetTransmission(input({
    repricing: repricing({
      status: "CONTAMINATED",
      contaminationStatus: "CONTAMINATED",
      contaminants: [{
        eventId: "event-other",
        eventIdentityKey:
          "event:v1:US:2026-09-25T12:33:00.000Z:other-high-event",
        subject: "Other HIGH event",
        t0: "2026-09-25T12:33:00.000Z",
        t0Source: "SCHEDULED_AT",
      }],
    }),
  }));
  assertEqual(
    contaminated.status,
    "CONTAMINATED",
    "event-window contamination takes assessment precedence",
  );
  assertEqual(
    contaminated.coherentRuleIds.length,
    2,
    "measured response coherence stays visible under contamination",
  );

  assertThrows(
    "rules cannot be empty",
    () => assessCrossAssetTransmission(input({ rules: [] })),
  );
  assertThrows(
    "same driver and response key is invalid",
    () => assessCrossAssetTransmission(input({
      rules: [{
        driverObservationKey: dxyKey,
        responseObservationKey: dxyKey,
        expectedRelation: "SAME_DIRECTION",
        methodologyId: "event-window-directional-relation",
        methodologyVersion: "v1",
      }],
    })),
  );
  assertThrows(
    "unsupported expected relation fails closed",
    () => assessCrossAssetTransmission(input({
      rules: [{
        driverObservationKey: dxyKey,
        responseObservationKey: btcKey,
        expectedRelation:
          "UNSUPPORTED" as CrossAssetTransmissionRuleInput["expectedRelation"],
        methodologyId: "event-window-directional-relation",
        methodologyVersion: "v1",
      }],
    })),
  );
  assertThrows(
    "duplicate driver response pair is invalid",
    () => assessCrossAssetTransmission(input({
      rules: [rules[0], { ...rules[0], methodologyVersion: "v2" }],
    })),
  );
  assertThrows(
    "methodology version is required",
    () => assessCrossAssetTransmission(input({
      rules: [{
        ...rules[0],
        methodologyVersion: " ",
      }],
    })),
  );
}

main();
