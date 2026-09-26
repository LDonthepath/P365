import { createHash } from "node:crypto";
import type {
  EventRepricingAssessment,
  EventRepricingDirection,
  EventRepricingResponse,
} from "./event-repricing";

export const CROSS_ASSET_TRANSMISSION_POLICY_V1 =
  "explicit-relationship-event-window-transmission-v1" as const;

export type TransmissionExpectedRelation =
  | "SAME_DIRECTION"
  | "OPPOSITE_DIRECTION";

export type TransmissionObservedRelation =
  | "SAME_DIRECTION"
  | "OPPOSITE_DIRECTION"
  | "UNKNOWN";

export type CrossAssetTransmissionRuleInput = {
  driverObservationKey: string;
  responseObservationKey: string;
  expectedRelation: TransmissionExpectedRelation;
  methodologyId: string;
  methodologyVersion: string;
};

export type CrossAssetTransmissionRule = CrossAssetTransmissionRuleInput & {
  id: string;
};

export type CrossAssetTransmissionEdgeStatus =
  | "COHERENT"
  | "DIVERGENT"
  | "RESPONSE_BELOW_THRESHOLD"
  | "DRIVER_NOT_REPRICED"
  | "UNRESOLVED";

export type CrossAssetTransmissionStatus =
  | "COHERENT"
  | "DIVERGENT"
  | "MIXED"
  | "NO_RESPONSE_REPRICING"
  | "INDETERMINATE"
  | "CONTAMINATED";

export type CrossAssetTransmissionEdge = {
  ruleId: string;
  driverObservationKey: string;
  responseObservationKey: string;
  expectedRelation: TransmissionExpectedRelation;
  observedRelation: TransmissionObservedRelation;
  methodologyId: string;
  methodologyVersion: string;
  status: CrossAssetTransmissionEdgeStatus;
  driverRepricingStatus: EventRepricingResponse["status"] | "MISSING";
  responseRepricingStatus: EventRepricingResponse["status"] | "MISSING";
  driverDirection: EventRepricingDirection | "UNKNOWN";
  responseDirection: EventRepricingDirection | "UNKNOWN";
  driverMeasuredMagnitude: number | null;
  responseMeasuredMagnitude: number | null;
  reason?: string;
};

export type CrossAssetTransmissionAssessment = {
  id: string;
  version: "v1";
  policy: typeof CROSS_ASSET_TRANSMISSION_POLICY_V1;
  repricingAssessmentId: string;
  comparisonId: string;
  windowId: string;
  eventIdentityKey: string;
  afterRole: EventRepricingAssessment["afterRole"];
  quality: EventRepricingAssessment["quality"];
  contaminationStatus: EventRepricingAssessment["contaminationStatus"];
  causalAttribution: "NOT_EVALUATED";
  status: CrossAssetTransmissionStatus;
  rules: CrossAssetTransmissionRule[];
  edges: CrossAssetTransmissionEdge[];
  coherentRuleIds: string[];
  divergentRuleIds: string[];
  responseBelowThresholdRuleIds: string[];
  driverNotRepricedRuleIds: string[];
  unresolvedRuleIds: string[];
};

export type CrossAssetTransmissionInput = {
  repricing: EventRepricingAssessment;
  rules: CrossAssetTransmissionRuleInput[];
};

function stableStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function normalizeRules(
  rules: CrossAssetTransmissionRuleInput[],
): CrossAssetTransmissionRule[] {
  if (rules.length === 0) {
    throw new Error(
      "Cross-Asset Transmission requires at least one explicit relationship rule.",
    );
  }

  const pairs = new Set<string>();
  const normalized = rules.map((rule) => {
    const driverObservationKey = rule.driverObservationKey.trim();
    const responseObservationKey = rule.responseObservationKey.trim();
    const methodologyId = rule.methodologyId.trim();
    const methodologyVersion = rule.methodologyVersion.trim();

    if (!driverObservationKey || !responseObservationKey) {
      throw new Error(
        "Cross-Asset Transmission relationship keys must be non-empty.",
      );
    }
    if (driverObservationKey === responseObservationKey) {
      throw new Error(
        "Cross-Asset Transmission driver and response keys must differ.",
      );
    }
    if (
      rule.expectedRelation !== "SAME_DIRECTION"
      && rule.expectedRelation !== "OPPOSITE_DIRECTION"
    ) {
      throw new Error(
        "Cross-Asset Transmission expected relation is not supported.",
      );
    }
    if (!methodologyId || !methodologyVersion) {
      throw new Error(
        "Cross-Asset Transmission requires methodology ID and version.",
      );
    }

    const pairKey = driverObservationKey + "->" + responseObservationKey;
    if (pairs.has(pairKey)) {
      throw new Error(
        "Cross-Asset Transmission rules must use unique driver/response pairs.",
      );
    }
    pairs.add(pairKey);

    const normalizedRule: CrossAssetTransmissionRuleInput = {
      driverObservationKey,
      responseObservationKey,
      expectedRelation: rule.expectedRelation,
      methodologyId,
      methodologyVersion,
    };

    return {
      id: "transmission-rule-v1-" + stableHash(normalizedRule),
      ...normalizedRule,
    };
  });

  return normalized.sort(
    (a, b) =>
      a.driverObservationKey.localeCompare(b.driverObservationKey)
      || a.responseObservationKey.localeCompare(b.responseObservationKey)
      || a.methodologyId.localeCompare(b.methodologyId)
      || a.methodologyVersion.localeCompare(b.methodologyVersion),
  );
}

function responseMap(
  responses: EventRepricingResponse[],
): Map<string, EventRepricingResponse> {
  const map = new Map<string, EventRepricingResponse>();
  for (const response of responses) {
    if (map.has(response.observationKey)) {
      throw new Error(
        "Cross-Asset Transmission requires unique repricing response keys.",
      );
    }
    map.set(response.observationKey, response);
  }
  return map;
}

function directionalRelation(
  driver: EventRepricingDirection,
  response: EventRepricingDirection,
): TransmissionObservedRelation {
  const driverDirectional = driver === "UP" || driver === "DOWN";
  const responseDirectional = response === "UP" || response === "DOWN";
  if (!driverDirectional || !responseDirectional) return "UNKNOWN";
  return driver === response ? "SAME_DIRECTION" : "OPPOSITE_DIRECTION";
}

function missingEdge(
  rule: CrossAssetTransmissionRule,
  driver: EventRepricingResponse | undefined,
  response: EventRepricingResponse | undefined,
): CrossAssetTransmissionEdge {
  return {
    ruleId: rule.id,
    driverObservationKey: rule.driverObservationKey,
    responseObservationKey: rule.responseObservationKey,
    expectedRelation: rule.expectedRelation,
    observedRelation: "UNKNOWN",
    methodologyId: rule.methodologyId,
    methodologyVersion: rule.methodologyVersion,
    status: "UNRESOLVED",
    driverRepricingStatus: driver?.status ?? "MISSING",
    responseRepricingStatus: response?.status ?? "MISSING",
    driverDirection: driver?.direction ?? "UNKNOWN",
    responseDirection: response?.direction ?? "UNKNOWN",
    driverMeasuredMagnitude: driver?.measuredMagnitude ?? null,
    responseMeasuredMagnitude: response?.measuredMagnitude ?? null,
    reason: !driver && !response
      ? "Driver and response keys are absent from the Event Repricing assessment."
      : !driver
      ? "Driver key is absent from the Event Repricing assessment."
      : "Response key is absent from the Event Repricing assessment.",
  };
}

function edgeForRule(
  rule: CrossAssetTransmissionRule,
  responses: Map<string, EventRepricingResponse>,
): CrossAssetTransmissionEdge {
  const driver = responses.get(rule.driverObservationKey);
  const response = responses.get(rule.responseObservationKey);

  if (!driver || !response) {
    return missingEdge(rule, driver, response);
  }

  const base = {
    ruleId: rule.id,
    driverObservationKey: rule.driverObservationKey,
    responseObservationKey: rule.responseObservationKey,
    expectedRelation: rule.expectedRelation,
    observedRelation: "UNKNOWN" as TransmissionObservedRelation,
    methodologyId: rule.methodologyId,
    methodologyVersion: rule.methodologyVersion,
    driverRepricingStatus: driver.status,
    responseRepricingStatus: response.status,
    driverDirection: driver.direction,
    responseDirection: response.direction,
    driverMeasuredMagnitude: driver.measuredMagnitude,
    responseMeasuredMagnitude: response.measuredMagnitude,
  };

  if (driver.status === "UNRESOLVED") {
    return {
      ...base,
      status: "UNRESOLVED",
      reason: "Driver repricing input is unresolved.",
    };
  }

  if (driver.status === "BELOW_THRESHOLD") {
    return {
      ...base,
      status: "DRIVER_NOT_REPRICED",
      reason:
        "Driver did not cross its explicit RPR-001 threshold; transmission is not qualified for this rule.",
    };
  }

  if (response.status === "UNRESOLVED") {
    return {
      ...base,
      status: "UNRESOLVED",
      reason: "Response repricing input is unresolved.",
    };
  }

  if (response.status === "BELOW_THRESHOLD") {
    return {
      ...base,
      status: "RESPONSE_BELOW_THRESHOLD",
      reason:
        "Driver repriced but response did not cross its explicit RPR-001 threshold.",
    };
  }

  const observedRelation = directionalRelation(
    driver.direction,
    response.direction,
  );
  if (observedRelation === "UNKNOWN") {
    return {
      ...base,
      observedRelation,
      status: "UNRESOLVED",
      reason:
        "Qualified repricing inputs do not provide directional UP/DOWN evidence.",
    };
  }

  return {
    ...base,
    observedRelation,
    status: observedRelation === rule.expectedRelation
      ? "COHERENT"
      : "DIVERGENT",
  };
}

function deterministicAssessmentId(
  assessment: Omit<CrossAssetTransmissionAssessment, "id">,
): string {
  return "cross-asset-transmission-v1-" + stableHash(assessment);
}

/**
 * Tests cross-asset event-window response coherence using explicit,
 * caller-owned relationship methodology.
 *
 * This function does not infer causality and does not derive relationship
 * direction from static market assumptions. It only evaluates whether
 * threshold-qualified RPR-001 responses match the supplied relationship rule.
 */
export function assessCrossAssetTransmission(
  input: CrossAssetTransmissionInput,
): CrossAssetTransmissionAssessment {
  if (input.repricing.causalAttribution !== "NOT_EVALUATED") {
    throw new Error(
      "Cross-Asset Transmission requires non-causal RPR-001 input.",
    );
  }
  if (input.repricing.beforeRole !== "PRE") {
    throw new Error(
      "Cross-Asset Transmission requires an event-window PRE baseline.",
    );
  }
  if (!input.repricing.id.trim() || !input.repricing.comparisonId.trim()) {
    throw new Error(
      "Cross-Asset Transmission requires RPR-001 and CMP-001 lineage.",
    );
  }

  const rules = normalizeRules(input.rules);
  const responses = responseMap(input.repricing.responses);
  const edges = rules.map((rule) => edgeForRule(rule, responses));

  const coherentRuleIds = stableStrings(
    edges.filter((edge) => edge.status === "COHERENT")
      .map((edge) => edge.ruleId),
  );
  const divergentRuleIds = stableStrings(
    edges.filter((edge) => edge.status === "DIVERGENT")
      .map((edge) => edge.ruleId),
  );
  const responseBelowThresholdRuleIds = stableStrings(
    edges.filter((edge) => edge.status === "RESPONSE_BELOW_THRESHOLD")
      .map((edge) => edge.ruleId),
  );
  const driverNotRepricedRuleIds = stableStrings(
    edges.filter((edge) => edge.status === "DRIVER_NOT_REPRICED")
      .map((edge) => edge.ruleId),
  );
  const unresolvedRuleIds = stableStrings(
    edges.filter((edge) => edge.status === "UNRESOLVED")
      .map((edge) => edge.ruleId),
  );

  let status: CrossAssetTransmissionStatus;
  if (
    input.repricing.status === "CONTAMINATED"
    || input.repricing.contaminationStatus === "CONTAMINATED"
  ) {
    status = "CONTAMINATED";
  } else if (
    input.repricing.status === "INDETERMINATE"
    || input.repricing.quality !== "COMPLETE"
    || unresolvedRuleIds.length > 0
    || driverNotRepricedRuleIds.length > 0
  ) {
    status = "INDETERMINATE";
  } else {
    const classes = [
      coherentRuleIds.length > 0 ? "COHERENT" : null,
      divergentRuleIds.length > 0 ? "DIVERGENT" : null,
      responseBelowThresholdRuleIds.length > 0
        ? "NO_RESPONSE_REPRICING"
        : null,
    ].filter((value): value is
      | "COHERENT"
      | "DIVERGENT"
      | "NO_RESPONSE_REPRICING" => value !== null);

    status = classes.length === 1
      ? classes[0]
      : "MIXED";
  }

  const withoutId: Omit<CrossAssetTransmissionAssessment, "id"> = {
    version: "v1",
    policy: CROSS_ASSET_TRANSMISSION_POLICY_V1,
    repricingAssessmentId: input.repricing.id,
    comparisonId: input.repricing.comparisonId,
    windowId: input.repricing.windowId,
    eventIdentityKey: input.repricing.eventIdentityKey,
    afterRole: input.repricing.afterRole,
    quality: input.repricing.quality,
    contaminationStatus: input.repricing.contaminationStatus,
    causalAttribution: "NOT_EVALUATED",
    status,
    rules,
    edges,
    coherentRuleIds,
    divergentRuleIds,
    responseBelowThresholdRuleIds,
    driverNotRepricedRuleIds,
    unresolvedRuleIds,
  };

  return {
    id: deterministicAssessmentId(withoutId),
    ...withoutId,
  };
}
