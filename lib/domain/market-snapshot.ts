import { createHash } from "node:crypto";
import type { FactualBaseline } from "./baseline";
import type { ExpectationBaseline } from "./expectation-baseline";
import type { PricingBaseline } from "./pricing-baseline";
import type { Event, Observation } from "./types";

export type MarketSnapshotQuality = "COMPLETE" | "PARTIAL" | "STALE" | "UNKNOWN";
export type MarketSnapshotRequirementKind = "OBSERVATION" | "EVENT" | "BASELINE";

export type MarketSnapshotRequirement = {
  kind: MarketSnapshotRequirementKind;
  key: string;
};

export type MarketSnapshotObservationRef = {
  key: string;
  observationId: string;
  evidenceId: string;
  sourceId: string;
  quality: Observation["quality"];
};

export type MarketSnapshotEventRef = {
  key: string;
  eventId: string;
  evidenceId: string;
  sourceId: string;
};

export type MarketSnapshotBaselineRef = {
  key: string;
  kind: "FACTUAL" | "EXPECTATION" | "PRICING";
  status: string;
  policy: string;
  observationIds: string[];
  eventResultIds: string[];
  evidenceIds: string[];
};

export type MarketSnapshot = {
  id: string;
  version: "v1";
  capturedAt: string;
  scope: string;
  observationRefs: MarketSnapshotObservationRef[];
  eventRefs: MarketSnapshotEventRef[];
  baselineRefs: MarketSnapshotBaselineRef[];
  /**
   * Deferred higher-order State references. SNP-001 does not populate these.
   * The field is retained to match the normative Snapshot contract.
   */
  stateRefs: string[];
  /**
   * Provider-health records are not yet canonical/persisted references, so
   * SNP-001 leaves this empty rather than accepting unverified opaque IDs.
   */
  sourceHealthRefs: string[];
  requirements: MarketSnapshotRequirement[];
  missingRequirements: MarketSnapshotRequirement[];
  quality: MarketSnapshotQuality;
  metadata?: Record<string, string | number | boolean | null>;
};

export type MarketSnapshotRequest = {
  capturedAt: string;
  scope: string;
  observations: Observation[];
  events?: Event[];
  baselines?: Array<FactualBaseline | ExpectationBaseline | PricingBaseline>;
  requirements: MarketSnapshotRequirement[];
  metadata?: Record<string, string | number | boolean | null>;
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Market Snapshot requires valid " + field + ".");
  }
  return parsed;
}

function nonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("Market Snapshot requires non-empty " + field + ".");
  return normalized;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function stableMetadata(
  metadata: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function observationSeriesKey(observation: Observation): string {
  const identityKey = observation.identity?.seriesKey;
  if (identityKey?.trim()) return identityKey.trim();
  const seriesId = observation.metadata?.seriesId;
  if (typeof seriesId === "string" && seriesId.trim()) return seriesId.trim();
  const metricId = observation.metadata?.metricId;
  if (typeof metricId === "string" && metricId.trim()) return metricId.trim();
  throw new Error(
    "Market Snapshot observation " + observation.id + " has no stable series key.",
  );
}

export function marketSnapshotObservationKey(observation: Observation): string {
  return [
    observation.domain,
    observationSeriesKey(observation),
    observation.sourceId,
  ].join(":");
}

export function marketSnapshotEventKey(event: Event): string {
  return event.identity?.key?.trim()
    ? event.identity.key
    : "id:" + event.id;
}

export function marketSnapshotBaselineKey(
  baseline: FactualBaseline | ExpectationBaseline | PricingBaseline,
): string {
  if (baseline.kind === "FACTUAL") {
    return [
      "FACTUAL",
      baseline.currentObservationId,
      baseline.sourceId,
    ].join(":");
  }
  if (baseline.kind === "EXPECTATION") {
    return [
      "EXPECTATION",
      baseline.eventIdentityKey,
      baseline.sourceId,
      baseline.expectedType ?? "ANY",
    ].join(":");
  }
  return [
    "PRICING",
    baseline.seriesKey,
    baseline.sourceId,
  ].join(":");
}

function factualBaselineRef(baseline: FactualBaseline): MarketSnapshotBaselineRef {
  return {
    key: marketSnapshotBaselineKey(baseline),
    kind: "FACTUAL",
    status: baseline.status,
    policy: baseline.qualityPolicy,
    observationIds: sortedUnique([
      baseline.currentObservationId,
      ...(baseline.baselineObservationId ? [baseline.baselineObservationId] : []),
    ]),
    eventResultIds: [],
    evidenceIds: [],
  };
}

function expectationBaselineRef(
  baseline: ExpectationBaseline,
): MarketSnapshotBaselineRef {
  return {
    key: marketSnapshotBaselineKey(baseline),
    kind: "EXPECTATION",
    status: baseline.status,
    policy: baseline.selectionPolicy,
    observationIds: [],
    eventResultIds: baseline.baselineEventResultId
      ? [baseline.baselineEventResultId]
      : [],
    evidenceIds: baseline.evidenceId ? [baseline.evidenceId] : [],
  };
}

function pricingBaselineRef(baseline: PricingBaseline): MarketSnapshotBaselineRef {
  return {
    key: marketSnapshotBaselineKey(baseline),
    kind: "PRICING",
    status: baseline.status,
    policy: baseline.selectionPolicy,
    observationIds: baseline.observationId ? [baseline.observationId] : [],
    eventResultIds: [],
    evidenceIds: baseline.evidenceId ? [baseline.evidenceId] : [],
  };
}

function baselineRef(
  baseline: FactualBaseline | ExpectationBaseline | PricingBaseline,
): MarketSnapshotBaselineRef {
  if (baseline.kind === "FACTUAL") return factualBaselineRef(baseline);
  if (baseline.kind === "EXPECTATION") return expectationBaselineRef(baseline);
  return pricingBaselineRef(baseline);
}

function validateBaselineAvailability(
  baseline: FactualBaseline | ExpectationBaseline | PricingBaseline,
  capturedAtMs: number,
  observationIds: Set<string>,
): void {
  if (baseline.kind === "FACTUAL") {
    if (!observationIds.has(baseline.currentObservationId)) {
      throw new Error(
        "Factual baseline current observation must be included in the snapshot reference set.",
      );
    }
    if (
      baseline.baselineObservationId
      && !observationIds.has(baseline.baselineObservationId)
    ) {
      throw new Error(
        "Factual baseline predecessor observation must be included in the snapshot reference set.",
      );
    }
    return;
  }

  const asOfMs = timestamp(baseline.asOf, baseline.kind + " baseline asOf");
  if (asOfMs > capturedAtMs) {
    throw new Error(
      baseline.kind + " baseline asOf is later than snapshot capturedAt.",
    );
  }

  if (baseline.retrievedAt) {
    const retrievedAtMs = timestamp(
      baseline.retrievedAt,
      baseline.kind + " baseline retrievedAt",
    );
    if (retrievedAtMs > capturedAtMs) {
      throw new Error(
        baseline.kind + " baseline was not available by snapshot capturedAt.",
      );
    }
  }
}

function baselineQuality(
  baseline: FactualBaseline | ExpectationBaseline | PricingBaseline,
): MarketSnapshotQuality {
  if (baseline.status === "UNKNOWN") return "UNKNOWN";
  if (baseline.status === "STALE") return "STALE";
  if (
    baseline.status === "PARTIAL"
    || baseline.status === "MISSING"
    || baseline.status === "INCOMPATIBLE"
  ) {
    return "PARTIAL";
  }
  return "COMPLETE";
}

function combineQuality(qualities: MarketSnapshotQuality[]): MarketSnapshotQuality {
  if (qualities.includes("UNKNOWN")) return "UNKNOWN";
  // Missing/incomplete scope is more material than staleness of an included
  // reference because a STALE label alone would hide absent required data.
  if (qualities.includes("PARTIAL")) return "PARTIAL";
  if (qualities.includes("STALE")) return "STALE";
  return "COMPLETE";
}

function deterministicSnapshotId(snapshot: Omit<MarketSnapshot, "id">): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(snapshot), "utf8")
    .digest("hex");
  return "market-snapshot-v1-" + hash;
}

function validateRequirement(
  requirement: MarketSnapshotRequirement,
): MarketSnapshotRequirement {
  if (!["OBSERVATION", "EVENT", "BASELINE"].includes(requirement.kind)) {
    throw new Error("Market Snapshot requirement has an invalid kind.");
  }
  return {
    kind: requirement.kind,
    key: nonEmpty(requirement.key, "requirement key"),
  };
}

/**
 * Builds an immutable reference-only Market Snapshot at a caller-owned
 * knowledge cutoff. Values stay authoritative in canonical Observation/Event
 * records and baseline inputs; the Snapshot stores only deterministic lineage.
 */
export function buildMarketSnapshot(request: MarketSnapshotRequest): MarketSnapshot {
  const capturedAtMs = timestamp(request.capturedAt, "capturedAt");
  const capturedAt = new Date(capturedAtMs).toISOString();
  const scope = nonEmpty(request.scope, "scope");

  if (!Array.isArray(request.requirements) || request.requirements.length === 0) {
    throw new Error(
      "Market Snapshot requires at least one explicit scope requirement.",
    );
  }

  const requirements = request.requirements
    .map(validateRequirement)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));

  const requirementIds = new Set<string>();
  for (const requirement of requirements) {
    const id = requirement.kind + ":" + requirement.key;
    if (requirementIds.has(id)) {
      throw new Error("Market Snapshot requirements must be unique.");
    }
    requirementIds.add(id);
  }

  const observationById = new Map<string, Observation>();
  for (const observation of request.observations) {
    const observedAtMs = timestamp(
      observation.observedAt,
      "Observation.observedAt",
    );
    const retrievedAtMs = timestamp(
      observation.retrievedAt,
      "Observation.retrievedAt",
    );
    if (observedAtMs > capturedAtMs || retrievedAtMs > capturedAtMs) {
      throw new Error(
        "Observation " + observation.id + " was not point-in-time available at snapshot capturedAt.",
      );
    }
    observationById.set(observation.id, observation);
  }

  const eventById = new Map<string, Event>();
  for (const event of request.events ?? []) {
    const retrievedAtMs = timestamp(event.retrievedAt, "Event.retrievedAt");
    if (retrievedAtMs > capturedAtMs) {
      throw new Error(
        "Event " + event.id + " was not available at snapshot capturedAt.",
      );
    }
    if (event.occurredAt && timestamp(event.occurredAt, "Event.occurredAt") > capturedAtMs) {
      throw new Error(
        "Event " + event.id + " contains a future occurredAt relative to snapshot capturedAt.",
      );
    }
    if (event.releasedAt && timestamp(event.releasedAt, "Event.releasedAt") > capturedAtMs) {
      throw new Error(
        "Event " + event.id + " contains a future releasedAt relative to snapshot capturedAt.",
      );
    }
    eventById.set(event.id, event);
  }

  const observationIds = new Set(observationById.keys());
  const baselines = request.baselines ?? [];
  for (const baseline of baselines) {
    validateBaselineAvailability(baseline, capturedAtMs, observationIds);
  }

  const observationRefs = [...observationById.values()]
    .map((observation): MarketSnapshotObservationRef => ({
      key: marketSnapshotObservationKey(observation),
      observationId: observation.id,
      evidenceId: observation.evidenceId,
      sourceId: observation.sourceId,
      quality: observation.quality,
    }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.observationId.localeCompare(b.observationId));

  const observationKeys = new Set<string>();
  for (const ref of observationRefs) {
    if (observationKeys.has(ref.key)) {
      throw new Error(
        "Market Snapshot cannot contain multiple observations for the same semantic/provider slot.",
      );
    }
    observationKeys.add(ref.key);
  }

  const eventRefs = [...eventById.values()]
    .map((event): MarketSnapshotEventRef => ({
      key: marketSnapshotEventKey(event),
      eventId: event.id,
      evidenceId: event.evidenceId,
      sourceId: event.sourceId,
    }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.eventId.localeCompare(b.eventId));

  const eventKeys = new Set<string>();
  for (const ref of eventRefs) {
    if (eventKeys.has(ref.key)) {
      throw new Error(
        "Market Snapshot requires provider-duplicate Events to be reconciled before capture.",
      );
    }
    eventKeys.add(ref.key);
  }

  const baselineRefs = baselines
    .map(baselineRef)
    .sort((a, b) => a.key.localeCompare(b.key));

  const baselineKeys = new Set<string>();
  for (const ref of baselineRefs) {
    if (baselineKeys.has(ref.key)) {
      throw new Error("Market Snapshot baseline reference keys must be unique.");
    }
    baselineKeys.add(ref.key);
  }

  const available = new Set<string>([
    ...observationRefs.map((ref) => "OBSERVATION:" + ref.key),
    ...eventRefs.map((ref) => "EVENT:" + ref.key),
    ...baselineRefs.map((ref) => "BASELINE:" + ref.key),
  ]);

  const missingRequirements = requirements.filter(
    (requirement) => !available.has(requirement.kind + ":" + requirement.key),
  );

  const referenceQualities: MarketSnapshotQuality[] = [
    ...observationRefs.map((ref) => {
      if (ref.quality === "UNKNOWN") return "UNKNOWN" as const;
      if (ref.quality === "STALE") return "STALE" as const;
      if (ref.quality === "PARTIAL") return "PARTIAL" as const;
      return "COMPLETE" as const;
    }),
    ...baselines.map(baselineQuality),
    ...(missingRequirements.length > 0 ? ["PARTIAL" as const] : []),
  ];

  const withoutId: Omit<MarketSnapshot, "id"> = {
    version: "v1",
    capturedAt,
    scope,
    observationRefs,
    eventRefs,
    baselineRefs,
    stateRefs: [],
    sourceHealthRefs: [],
    requirements,
    missingRequirements,
    quality: combineQuality(referenceQualities),
    ...(request.metadata ? { metadata: stableMetadata(request.metadata) } : {}),
  };

  return {
    id: deterministicSnapshotId(withoutId),
    ...withoutId,
  };
}
