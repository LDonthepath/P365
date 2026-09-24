import { createHash } from "node:crypto";
import {
  marketSnapshotObservationKey,
  type MarketSnapshot,
  type MarketSnapshotBaselineRef,
  type MarketSnapshotEventRef,
  type MarketSnapshotObservationRef,
  type MarketSnapshotQuality,
} from "./market-snapshot";
import type { DataQuality, Observation } from "./types";

export const SNAPSHOT_COMPARISON_POLICY_V1 =
  "point-in-time-semantic-slot-comparison-v1" as const;

export type SnapshotComparisonQuality = MarketSnapshotQuality;

export type SnapshotObservationChangeStatus =
  | "CHANGED"
  | "UNCHANGED"
  | "ADDED"
  | "REMOVED"
  | "INCOMPATIBLE"
  | "UNKNOWN";

export type SnapshotReferenceChangeStatus =
  | "CHANGED"
  | "UNCHANGED"
  | "ADDED"
  | "REMOVED";

export type SnapshotObservationChange = {
  key: string;
  status: SnapshotObservationChangeStatus;
  beforeObservationId: string | null;
  afterObservationId: string | null;
  beforeValue: number | null;
  afterValue: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
  unit: string | null;
  frequency: string | null;
  beforeObservedAt: string | null;
  afterObservedAt: string | null;
  beforeQuality: DataQuality | null;
  afterQuality: DataQuality | null;
  evidenceIds: string[];
  reason?: string;
};

export type SnapshotEventReferenceChange = {
  key: string;
  status: SnapshotReferenceChangeStatus;
  beforeEventId: string | null;
  afterEventId: string | null;
  evidenceIds: string[];
};

export type SnapshotBaselineReferenceChange = {
  key: string;
  status: SnapshotReferenceChangeStatus;
  kind: MarketSnapshotBaselineRef["kind"] | null;
  beforeStatus: string | null;
  afterStatus: string | null;
  beforePolicy: string | null;
  afterPolicy: string | null;
  observationIds: string[];
  eventResultIds: string[];
  evidenceIds: string[];
};

export type SnapshotComparison = {
  id: string;
  version: "v1";
  policy: typeof SNAPSHOT_COMPARISON_POLICY_V1;
  scope: string;
  beforeSnapshotId: string;
  afterSnapshotId: string;
  beforeCapturedAt: string;
  afterCapturedAt: string;
  elapsedMs: number;
  quality: SnapshotComparisonQuality;
  observationChanges: SnapshotObservationChange[];
  eventReferenceChanges: SnapshotEventReferenceChange[];
  baselineReferenceChanges: SnapshotBaselineReferenceChange[];
  missingObservationIds: string[];
};

export type SnapshotComparisonInput = {
  before: MarketSnapshot;
  after: MarketSnapshot;
  observations: Observation[];
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Snapshot Comparison requires valid " + field + ".");
  }
  return parsed;
}

function stableStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function metadataString(
  observation: Observation,
  key: string,
): string | null {
  const value = observation.metadata?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function finiteNumericValue(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function qualityFromObservation(quality: DataQuality): SnapshotComparisonQuality {
  if (quality === "UNKNOWN") return "UNKNOWN";
  if (quality === "PARTIAL") return "PARTIAL";
  if (quality === "STALE") return "STALE";
  return "COMPLETE";
}

function combineQuality(
  qualities: SnapshotComparisonQuality[],
): SnapshotComparisonQuality {
  if (qualities.includes("UNKNOWN")) return "UNKNOWN";
  if (qualities.includes("PARTIAL")) return "PARTIAL";
  if (qualities.includes("STALE")) return "STALE";
  return "COMPLETE";
}

function snapshotRefMap<T extends { key: string }>(
  refs: T[],
  label: string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const ref of refs) {
    if (map.has(ref.key)) {
      throw new Error(
        "Snapshot Comparison requires unique " + label + " key: " + ref.key,
      );
    }
    map.set(ref.key, ref);
  }
  return map;
}

function canonicalObservationMap(
  observations: Observation[],
): Map<string, Observation> {
  const map = new Map<string, Observation>();
  for (const observation of observations) {
    if (map.has(observation.id)) {
      throw new Error(
        "Snapshot Comparison canonical Observation IDs must be unique.",
      );
    }
    map.set(observation.id, observation);
  }
  return map;
}

function validateResolvedObservation(
  observation: Observation,
  ref: MarketSnapshotObservationRef,
  capturedAtMs: number,
  side: "before" | "after",
): void {
  if (observation.id !== ref.observationId) {
    throw new Error(
      "Snapshot Comparison resolved "
      + side
      + " Observation ID does not match its Snapshot reference.",
    );
  }
  if (observation.sourceId !== ref.sourceId) {
    throw new Error(
      "Snapshot Comparison resolved "
      + side
      + " Observation source does not match its Snapshot reference.",
    );
  }
  if (observation.evidenceId !== ref.evidenceId) {
    throw new Error(
      "Snapshot Comparison resolved "
      + side
      + " Observation evidence does not match its Snapshot reference.",
    );
  }
  if (observation.quality !== ref.quality) {
    throw new Error(
      "Snapshot Comparison resolved "
      + side
      + " Observation quality does not match its Snapshot reference.",
    );
  }
  if (marketSnapshotObservationKey(observation) !== ref.key) {
    throw new Error(
      "Snapshot Comparison resolved "
      + side
      + " Observation semantic slot does not match its Snapshot reference.",
    );
  }

  const observedAtMs = timestamp(
    observation.observedAt,
    side + " Observation.observedAt",
  );
  const retrievedAtMs = timestamp(
    observation.retrievedAt,
    side + " Observation.retrievedAt",
  );
  if (observedAtMs > capturedAtMs || retrievedAtMs > capturedAtMs) {
    throw new Error(
      "Snapshot Comparison detected look-ahead in "
      + side
      + " Observation "
      + observation.id
      + ".",
    );
  }
}

function observationCompatibility(
  before: Observation,
  after: Observation,
): { compatible: true; unit: string | null; frequency: string | null }
  | { compatible: false; reason: string } {
  if (before.domain !== after.domain) {
    return {
      compatible: false,
      reason: "Observation legacy domains differ.",
    };
  }
  if (before.sourceId !== after.sourceId) {
    return {
      compatible: false,
      reason: "Observation providers differ.",
    };
  }

  const beforeUnit = metadataString(before, "unit");
  const afterUnit = metadataString(after, "unit");
  if (beforeUnit === null || afterUnit === null) {
    return {
      compatible: false,
      reason: "Observation unit is missing; numerical comparison is not qualified.",
    };
  }
  if (beforeUnit !== afterUnit) {
    return {
      compatible: false,
      reason: "Observation units differ or are not equally qualified.",
    };
  }

  const beforeFrequency = metadataString(before, "frequency");
  const afterFrequency = metadataString(after, "frequency");
  if (beforeFrequency !== afterFrequency) {
    return {
      compatible: false,
      reason: "Observation frequencies differ or are not equally qualified.",
    };
  }

  return {
    compatible: true,
    unit: beforeUnit,
    frequency: beforeFrequency,
  };
}

function observationChangeForKey(input: {
  key: string;
  beforeRef?: MarketSnapshotObservationRef;
  afterRef?: MarketSnapshotObservationRef;
  canonical: Map<string, Observation>;
  beforeCapturedAtMs: number;
  afterCapturedAtMs: number;
  missingObservationIds: Set<string>;
}): SnapshotObservationChange {
  const {
    key,
    beforeRef,
    afterRef,
    canonical,
    beforeCapturedAtMs,
    afterCapturedAtMs,
    missingObservationIds,
  } = input;

  const before = beforeRef
    ? canonical.get(beforeRef.observationId)
    : undefined;
  const after = afterRef
    ? canonical.get(afterRef.observationId)
    : undefined;

  if (beforeRef && !before) missingObservationIds.add(beforeRef.observationId);
  if (afterRef && !after) missingObservationIds.add(afterRef.observationId);

  if (before && beforeRef) {
    validateResolvedObservation(
      before,
      beforeRef,
      beforeCapturedAtMs,
      "before",
    );
  }
  if (after && afterRef) {
    validateResolvedObservation(
      after,
      afterRef,
      afterCapturedAtMs,
      "after",
    );
  }

  const base = {
    key,
    beforeObservationId: beforeRef?.observationId ?? null,
    afterObservationId: afterRef?.observationId ?? null,
    beforeValue: before ? finiteNumericValue(before.value) : null,
    afterValue: after ? finiteNumericValue(after.value) : null,
    absoluteDelta: null,
    percentDelta: null,
    unit: null,
    frequency: null,
    beforeObservedAt: before?.observedAt ?? null,
    afterObservedAt: after?.observedAt ?? null,
    beforeQuality: before?.quality ?? null,
    afterQuality: after?.quality ?? null,
    evidenceIds: stableStrings([
      ...(beforeRef ? [beforeRef.evidenceId] : []),
      ...(afterRef ? [afterRef.evidenceId] : []),
    ]),
  };

  if (beforeRef && !before) {
    return {
      ...base,
      status: "UNKNOWN",
      reason: "Before Snapshot Observation could not be resolved.",
    };
  }
  if (afterRef && !after) {
    return {
      ...base,
      status: "UNKNOWN",
      reason: "After Snapshot Observation could not be resolved.",
    };
  }

  if (!beforeRef && afterRef && after) {
    return {
      ...base,
      status: "ADDED",
      unit: metadataString(after, "unit"),
      frequency: metadataString(after, "frequency"),
      reason: "Observation slot exists only in the after Snapshot.",
    };
  }

  if (beforeRef && before && !afterRef) {
    return {
      ...base,
      status: "REMOVED",
      unit: metadataString(before, "unit"),
      frequency: metadataString(before, "frequency"),
      reason: "Observation slot exists only in the before Snapshot.",
    };
  }

  if (!before || !after || !beforeRef || !afterRef) {
    return {
      ...base,
      status: "UNKNOWN",
      reason: "Observation slot could not be resolved on both sides.",
    };
  }

  const compatibility = observationCompatibility(before, after);
  if (!compatibility.compatible) {
    return {
      ...base,
      status: "INCOMPATIBLE",
      reason: compatibility.reason,
    };
  }

  const beforeValue = finiteNumericValue(before.value);
  const afterValue = finiteNumericValue(after.value);
  if (beforeValue === null || afterValue === null) {
    return {
      ...base,
      status: "UNKNOWN",
      unit: compatibility.unit,
      frequency: compatibility.frequency,
      reason: "Observation values are not finite numeric values.",
    };
  }

  const absoluteDelta = afterValue - beforeValue;
  const percentDelta = beforeValue === 0
    ? null
    : (absoluteDelta / beforeValue) * 100;

  return {
    ...base,
    status: absoluteDelta === 0 ? "UNCHANGED" : "CHANGED",
    beforeValue,
    afterValue,
    absoluteDelta,
    percentDelta,
    unit: compatibility.unit,
    frequency: compatibility.frequency,
  };
}

function eventReferenceChange(
  key: string,
  before?: MarketSnapshotEventRef,
  after?: MarketSnapshotEventRef,
): SnapshotEventReferenceChange {
  if (!before && after) {
    return {
      key,
      status: "ADDED",
      beforeEventId: null,
      afterEventId: after.eventId,
      evidenceIds: [after.evidenceId],
    };
  }
  if (before && !after) {
    return {
      key,
      status: "REMOVED",
      beforeEventId: before.eventId,
      afterEventId: null,
      evidenceIds: [before.evidenceId],
    };
  }
  if (!before || !after) {
    throw new Error("Snapshot Comparison event reference state is invalid.");
  }

  const changed = before.eventId !== after.eventId
    || before.sourceId !== after.sourceId
    || before.evidenceId !== after.evidenceId;

  return {
    key,
    status: changed ? "CHANGED" : "UNCHANGED",
    beforeEventId: before.eventId,
    afterEventId: after.eventId,
    evidenceIds: stableStrings([before.evidenceId, after.evidenceId]),
  };
}

function sameStrings(a: string[], b: string[]): boolean {
  return JSON.stringify(stableStrings(a)) === JSON.stringify(stableStrings(b));
}

function baselineReferenceChange(
  key: string,
  before?: MarketSnapshotBaselineRef,
  after?: MarketSnapshotBaselineRef,
): SnapshotBaselineReferenceChange {
  if (!before && after) {
    return {
      key,
      status: "ADDED",
      kind: after.kind,
      beforeStatus: null,
      afterStatus: after.status,
      beforePolicy: null,
      afterPolicy: after.policy,
      observationIds: stableStrings(after.observationIds),
      eventResultIds: stableStrings(after.eventResultIds),
      evidenceIds: stableStrings(after.evidenceIds),
    };
  }
  if (before && !after) {
    return {
      key,
      status: "REMOVED",
      kind: before.kind,
      beforeStatus: before.status,
      afterStatus: null,
      beforePolicy: before.policy,
      afterPolicy: null,
      observationIds: stableStrings(before.observationIds),
      eventResultIds: stableStrings(before.eventResultIds),
      evidenceIds: stableStrings(before.evidenceIds),
    };
  }
  if (!before || !after) {
    throw new Error("Snapshot Comparison baseline reference state is invalid.");
  }

  const changed = before.kind !== after.kind
    || before.status !== after.status
    || before.policy !== after.policy
    || !sameStrings(before.observationIds, after.observationIds)
    || !sameStrings(before.eventResultIds, after.eventResultIds)
    || !sameStrings(before.evidenceIds, after.evidenceIds);

  return {
    key,
    status: changed ? "CHANGED" : "UNCHANGED",
    kind: before.kind === after.kind ? before.kind : null,
    beforeStatus: before.status,
    afterStatus: after.status,
    beforePolicy: before.policy,
    afterPolicy: after.policy,
    observationIds: stableStrings([
      ...before.observationIds,
      ...after.observationIds,
    ]),
    eventResultIds: stableStrings([
      ...before.eventResultIds,
      ...after.eventResultIds,
    ]),
    evidenceIds: stableStrings([
      ...before.evidenceIds,
      ...after.evidenceIds,
    ]),
  };
}

function deterministicComparisonId(
  comparison: Omit<SnapshotComparison, "id">,
): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(comparison), "utf8")
    .digest("hex");
  return "snapshot-comparison-v1-" + hash;
}

/**
 * Produces a factual candidate-change artifact from two immutable Snapshots.
 *
 * This function does not call a market move "repricing", infer causality,
 * evaluate transmission, or attach directional meaning. It only compares
 * compatible canonical facts and reference lineage.
 */
export function compareMarketSnapshots(
  input: SnapshotComparisonInput,
): SnapshotComparison {
  const { before, after } = input;

  if (before.scope !== after.scope) {
    throw new Error(
      "Snapshot Comparison requires identical reasoning scope.",
    );
  }

  const beforeCapturedAtMs = timestamp(
    before.capturedAt,
    "before Snapshot.capturedAt",
  );
  const afterCapturedAtMs = timestamp(
    after.capturedAt,
    "after Snapshot.capturedAt",
  );
  if (afterCapturedAtMs <= beforeCapturedAtMs) {
    throw new Error(
      "Snapshot Comparison requires after.capturedAt to be later than before.capturedAt.",
    );
  }

  const canonical = canonicalObservationMap(input.observations);
  const beforeObservations = snapshotRefMap(
    before.observationRefs,
    "before Observation reference",
  );
  const afterObservations = snapshotRefMap(
    after.observationRefs,
    "after Observation reference",
  );
  const observationKeys = stableStrings([
    ...beforeObservations.keys(),
    ...afterObservations.keys(),
  ]);
  const missingObservationIds = new Set<string>();

  const observationChanges = observationKeys.map((key) =>
    observationChangeForKey({
      key,
      beforeRef: beforeObservations.get(key),
      afterRef: afterObservations.get(key),
      canonical,
      beforeCapturedAtMs,
      afterCapturedAtMs,
      missingObservationIds,
    }),
  );

  const beforeEvents = snapshotRefMap(
    before.eventRefs,
    "before Event reference",
  );
  const afterEvents = snapshotRefMap(
    after.eventRefs,
    "after Event reference",
  );
  const eventKeys = stableStrings([
    ...beforeEvents.keys(),
    ...afterEvents.keys(),
  ]);
  const eventReferenceChanges = eventKeys.map((key) =>
    eventReferenceChange(
      key,
      beforeEvents.get(key),
      afterEvents.get(key),
    ),
  );

  const beforeBaselines = snapshotRefMap(
    before.baselineRefs,
    "before Baseline reference",
  );
  const afterBaselines = snapshotRefMap(
    after.baselineRefs,
    "after Baseline reference",
  );
  const baselineKeys = stableStrings([
    ...beforeBaselines.keys(),
    ...afterBaselines.keys(),
  ]);
  const baselineReferenceChanges = baselineKeys.map((key) =>
    baselineReferenceChange(
      key,
      beforeBaselines.get(key),
      afterBaselines.get(key),
    ),
  );

  const changeQualities: SnapshotComparisonQuality[] = [
    before.quality,
    after.quality,
    ...observationChanges.flatMap((change) => {
      if (
        change.status === "ADDED"
        || change.status === "REMOVED"
        || change.status === "INCOMPATIBLE"
      ) {
        return ["PARTIAL" as const];
      }
      if (change.status === "UNKNOWN") {
        return ["UNKNOWN" as const];
      }
      return [
        ...(change.beforeQuality
          ? [qualityFromObservation(change.beforeQuality)]
          : []),
        ...(change.afterQuality
          ? [qualityFromObservation(change.afterQuality)]
          : []),
      ];
    }),
  ];

  const withoutId: Omit<SnapshotComparison, "id"> = {
    version: "v1",
    policy: SNAPSHOT_COMPARISON_POLICY_V1,
    scope: before.scope,
    beforeSnapshotId: before.id,
    afterSnapshotId: after.id,
    beforeCapturedAt: new Date(beforeCapturedAtMs).toISOString(),
    afterCapturedAt: new Date(afterCapturedAtMs).toISOString(),
    elapsedMs: afterCapturedAtMs - beforeCapturedAtMs,
    quality: combineQuality(changeQualities),
    observationChanges,
    eventReferenceChanges,
    baselineReferenceChanges,
    missingObservationIds: stableStrings([...missingObservationIds]),
  };

  return {
    id: deterministicComparisonId(withoutId),
    ...withoutId,
  };
}
