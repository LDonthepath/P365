import { createHash } from "node:crypto";
import type {
  EventWindowContaminant,
  EventWindowRole,
} from "./event-window";
import type {
  SnapshotComparison,
  SnapshotObservationChange,
} from "./snapshot-comparison";

export const EVENT_REPRICING_POLICY_V1 =
  "threshold-governed-event-window-repricing-v1" as const;

export type EventRepricingThresholdBasis =
  | "ABSOLUTE_PERCENT_CHANGE"
  | "ABSOLUTE_CHANGE";

export type EventRepricingThreshold = {
  observationKey: string;
  basis: EventRepricingThresholdBasis;
  minimumMagnitude: number;
};

export type EventRepricingResponseStatus =
  | "REPRICED"
  | "BELOW_THRESHOLD"
  | "UNRESOLVED";

export type EventRepricingDirection = "UP" | "DOWN" | "FLAT" | "UNKNOWN";

export type EventRepricingAssessmentStatus =
  | "REPRICING_OBSERVED"
  | "NO_REPRICING_OBSERVED"
  | "INDETERMINATE"
  | "CONTAMINATED";

export type EventRepricingResponse = {
  observationKey: string;
  status: EventRepricingResponseStatus;
  direction: EventRepricingDirection;
  basis: EventRepricingThresholdBasis;
  minimumMagnitude: number;
  measuredMagnitude: number | null;
  beforeValue: number | null;
  afterValue: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
  unit: string | null;
  frequency: string | null;
  reason?: string;
};

export type EventRepricingAssessment = {
  id: string;
  version: "v1";
  policy: typeof EVENT_REPRICING_POLICY_V1;
  windowId: string;
  eventIdentityKey: string;
  beforeRole: "PRE";
  afterRole: Exclude<EventWindowRole, "PRE">;
  comparisonId: string;
  beforeSnapshotId: string;
  afterSnapshotId: string;
  beforeCapturedAt: string;
  afterCapturedAt: string;
  quality: SnapshotComparison["quality"];
  contaminationStatus: "CLEAN" | "CONTAMINATED";
  contaminants: EventWindowContaminant[];
  causalAttribution: "NOT_EVALUATED";
  status: EventRepricingAssessmentStatus;
  thresholds: EventRepricingThreshold[];
  responses: EventRepricingResponse[];
  repricedObservationKeys: string[];
  unresolvedObservationKeys: string[];
  unconfiguredObservationKeys: string[];
};

export type EventRepricingInput = {
  windowId: string;
  eventIdentityKey: string;
  beforeRole: "PRE";
  afterRole: Exclude<EventWindowRole, "PRE">;
  contaminationStatus: "CLEAN" | "CONTAMINATED";
  contaminants: EventWindowContaminant[];
  comparison: SnapshotComparison;
  thresholds: EventRepricingThreshold[];
};

function stableStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizeThresholds(
  thresholds: EventRepricingThreshold[],
): EventRepricingThreshold[] {
  if (thresholds.length === 0) {
    throw new Error(
      "Event Repricing requires at least one explicit observation threshold.",
    );
  }

  const keys = new Set<string>();
  const normalized = thresholds.map((threshold) => {
    const observationKey = threshold.observationKey.trim();
    if (!observationKey) {
      throw new Error(
        "Event Repricing threshold observationKey must be non-empty.",
      );
    }
    if (keys.has(observationKey)) {
      throw new Error(
        "Event Repricing thresholds must use unique observation keys.",
      );
    }
    keys.add(observationKey);

    if (
      !Number.isFinite(threshold.minimumMagnitude)
      || threshold.minimumMagnitude <= 0
    ) {
      throw new Error(
        "Event Repricing threshold minimumMagnitude must be finite and greater than zero.",
      );
    }

    return {
      observationKey,
      basis: threshold.basis,
      minimumMagnitude: threshold.minimumMagnitude,
    };
  });

  return normalized.sort(
    (a, b) => a.observationKey.localeCompare(b.observationKey),
  );
}

function normalizeContaminants(
  contaminants: EventWindowContaminant[],
): EventWindowContaminant[] {
  const byIdentity = new Map<string, EventWindowContaminant>();
  for (const contaminant of contaminants) {
    const existing = byIdentity.get(contaminant.eventIdentityKey);
    if (!existing || contaminant.eventId.localeCompare(existing.eventId) < 0) {
      byIdentity.set(contaminant.eventIdentityKey, contaminant);
    }
  }
  return [...byIdentity.values()].sort(
    (a, b) => a.t0.localeCompare(b.t0)
      || a.eventIdentityKey.localeCompare(b.eventIdentityKey),
  );
}

function directionForChange(
  change: SnapshotObservationChange,
): EventRepricingDirection {
  if (change.absoluteDelta === null) return "UNKNOWN";
  if (change.absoluteDelta > 0) return "UP";
  if (change.absoluteDelta < 0) return "DOWN";
  return "FLAT";
}

function unresolvedResponse(
  threshold: EventRepricingThreshold,
  change: SnapshotObservationChange | undefined,
  reason: string,
): EventRepricingResponse {
  return {
    observationKey: threshold.observationKey,
    status: "UNRESOLVED",
    direction: change ? directionForChange(change) : "UNKNOWN",
    basis: threshold.basis,
    minimumMagnitude: threshold.minimumMagnitude,
    measuredMagnitude: null,
    beforeValue: change?.beforeValue ?? null,
    afterValue: change?.afterValue ?? null,
    absoluteDelta: change?.absoluteDelta ?? null,
    percentDelta: change?.percentDelta ?? null,
    unit: change?.unit ?? null,
    frequency: change?.frequency ?? null,
    reason,
  };
}

function responseForThreshold(
  threshold: EventRepricingThreshold,
  change: SnapshotObservationChange | undefined,
): EventRepricingResponse {
  if (!change) {
    return unresolvedResponse(
      threshold,
      undefined,
      "Configured observation key is absent from the Snapshot Comparison.",
    );
  }

  if (change.status !== "CHANGED" && change.status !== "UNCHANGED") {
    return unresolvedResponse(
      threshold,
      change,
      "Snapshot Comparison observation status is "
        + change.status
        + "; repricing threshold is not qualified.",
    );
  }

  const signedMeasure = threshold.basis === "ABSOLUTE_PERCENT_CHANGE"
    ? change.percentDelta
    : change.absoluteDelta;

  if (signedMeasure === null || !Number.isFinite(signedMeasure)) {
    return unresolvedResponse(
      threshold,
      change,
      threshold.basis === "ABSOLUTE_PERCENT_CHANGE"
        ? "Percent delta is unavailable for the configured repricing threshold."
        : "Absolute delta is unavailable for the configured repricing threshold.",
    );
  }

  const measuredMagnitude = Math.abs(signedMeasure);
  const crossed = measuredMagnitude >= threshold.minimumMagnitude;

  return {
    observationKey: threshold.observationKey,
    status: crossed ? "REPRICED" : "BELOW_THRESHOLD",
    direction: directionForChange(change),
    basis: threshold.basis,
    minimumMagnitude: threshold.minimumMagnitude,
    measuredMagnitude,
    beforeValue: change.beforeValue,
    afterValue: change.afterValue,
    absoluteDelta: change.absoluteDelta,
    percentDelta: change.percentDelta,
    unit: change.unit,
    frequency: change.frequency,
  };
}

function deterministicAssessmentId(
  assessment: Omit<EventRepricingAssessment, "id">,
): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(assessment), "utf8")
    .digest("hex");
  return "event-repricing-v1-" + hash;
}

/**
 * Applies explicit, caller-owned repricing thresholds to one PRE -> post-event
 * CMP-001 comparison.
 *
 * RPR-001 deliberately does not infer event surprise, causality, transmission,
 * regime, or trading meaning. "REPRICED" means only that the configured market
 * response threshold was crossed inside the qualified event window.
 */
export function assessEventRepricing(
  input: EventRepricingInput,
): EventRepricingAssessment {
  if (input.beforeRole !== "PRE") {
    throw new Error("Event Repricing requires a PRE baseline role.");
  }
  if (input.afterRole === ("PRE" as EventWindowRole)) {
    throw new Error("Event Repricing requires a post-event role.");
  }
  if (!input.windowId.trim() || !input.eventIdentityKey.trim()) {
    throw new Error(
      "Event Repricing requires qualified window and Event identity references.",
    );
  }

  const thresholds = normalizeThresholds(input.thresholds);
  const contaminants = normalizeContaminants(input.contaminants);
  const contaminationStatus = contaminants.length > 0
    ? "CONTAMINATED"
    : "CLEAN";

  if (input.contaminationStatus !== contaminationStatus) {
    throw new Error(
      "Event Repricing contamination status must match contaminant evidence.",
    );
  }

  const changes = new Map(
    input.comparison.observationChanges.map((change) => [change.key, change]),
  );
  const responses = thresholds.map((threshold) =>
    responseForThreshold(threshold, changes.get(threshold.observationKey))
  );

  const configuredKeys = new Set(
    thresholds.map((threshold) => threshold.observationKey),
  );
  const repricedObservationKeys = stableStrings(
    responses
      .filter((response) => response.status === "REPRICED")
      .map((response) => response.observationKey),
  );
  const unresolvedObservationKeys = stableStrings(
    responses
      .filter((response) => response.status === "UNRESOLVED")
      .map((response) => response.observationKey),
  );
  const unconfiguredObservationKeys = stableStrings(
    input.comparison.observationChanges
      .map((change) => change.key)
      .filter((key) => !configuredKeys.has(key)),
  );

  let status: EventRepricingAssessmentStatus;
  if (contaminationStatus === "CONTAMINATED") {
    status = "CONTAMINATED";
  } else if (repricedObservationKeys.length > 0) {
    status = "REPRICING_OBSERVED";
  } else if (unresolvedObservationKeys.length > 0) {
    status = "INDETERMINATE";
  } else {
    status = "NO_REPRICING_OBSERVED";
  }

  const withoutId: Omit<EventRepricingAssessment, "id"> = {
    version: "v1",
    policy: EVENT_REPRICING_POLICY_V1,
    windowId: input.windowId,
    eventIdentityKey: input.eventIdentityKey,
    beforeRole: "PRE",
    afterRole: input.afterRole,
    comparisonId: input.comparison.id,
    beforeSnapshotId: input.comparison.beforeSnapshotId,
    afterSnapshotId: input.comparison.afterSnapshotId,
    beforeCapturedAt: input.comparison.beforeCapturedAt,
    afterCapturedAt: input.comparison.afterCapturedAt,
    quality: input.comparison.quality,
    contaminationStatus,
    contaminants,
    causalAttribution: "NOT_EVALUATED",
    status,
    thresholds,
    responses,
    repricedObservationKeys,
    unresolvedObservationKeys,
    unconfiguredObservationKeys,
  };

  return {
    id: deterministicAssessmentId(withoutId),
    ...withoutId,
  };
}
