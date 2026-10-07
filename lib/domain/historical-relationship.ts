import { createHash } from "node:crypto";
import type { ObservationHistoryIdentity } from "../repositories/types";

export const HISTORICAL_RELATIONSHIP_POLICY_V1 = "historical-relationship-evidence-v1" as const;

export type RelationshipTransformation = "LEVEL" | "CHANGE";
export type HistoricalRelationshipStatus = "VALID" | "INSUFFICIENT_DATA";

export type HistoricalRelationshipMethodology = {
  methodologyId: string;
  methodologyVersion: string;
  left: ObservationHistoryIdentity;
  right: ObservationHistoryIdentity;
  leftSourceId?: string;
  rightSourceId?: string;
  transformation: RelationshipTransformation;
  observedAtOnOrAfter: string;
  observedAtOnOrBefore: string;
  asOf: string;
  minimumSampleSize: number;
};

export type HistoricalRelationshipPoint = {
  observedAt: string;
  leftObservationId: string;
  rightObservationId: string;
  leftValue: number;
  rightValue: number;
};

export type HistoricalRelationshipEvidence = {
  id: string;
  version: "v1";
  policy: typeof HISTORICAL_RELATIONSHIP_POLICY_V1;
  status: HistoricalRelationshipStatus;
  methodology: HistoricalRelationshipMethodology;
  sampleSize: number;
  correlation?: number;
  points: HistoricalRelationshipPoint[];
  causalAttribution: "NOT_EVALUATED";
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

/**
 * Shared REL Pearson primitive.
 *
 * This helper intentionally returns no interpretation threshold. Callers own
 * sample qualification and may only use the numeric association after their
 * own minimum-sample and temporal-alignment rules have passed.
 */
export function historicalRelationshipPearson(
  points: Array<{ leftValue: number; rightValue: number }>,
): number | undefined {
  if (points.length < 2) return undefined;

  const leftMean = points.reduce((sum, point) => sum + point.leftValue, 0) / points.length;
  const rightMean = points.reduce((sum, point) => sum + point.rightValue, 0) / points.length;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (const point of points) {
    const leftDelta = point.leftValue - leftMean;
    const rightDelta = point.rightValue - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }

  if (leftVariance <= 0 || rightVariance <= 0) return undefined;
  return covariance / Math.sqrt(leftVariance * rightVariance);
}

export function buildHistoricalRelationshipEvidence(input: {
  methodology: HistoricalRelationshipMethodology;
  points: HistoricalRelationshipPoint[];
}): HistoricalRelationshipEvidence {
  const { methodology } = input;
  for (const field of ["observedAtOnOrAfter", "observedAtOnOrBefore", "asOf"] as const) {
    if (!Number.isFinite(Date.parse(methodology[field]))) throw new Error("REL-001 requires valid " + field + ".");
  }
  if (Date.parse(methodology.observedAtOnOrAfter) > Date.parse(methodology.observedAtOnOrBefore)) {
    throw new Error("REL-001 requires an ordered observation window.");
  }
  if (!methodology.methodologyId.trim() || !methodology.methodologyVersion.trim()) {
    throw new Error("REL-001 requires explicit methodology identity and version.");
  }
  if (!Number.isInteger(methodology.minimumSampleSize) || methodology.minimumSampleSize < 2) {
    throw new Error("REL-001 minimumSampleSize must be an integer >= 2.");
  }

  const points = [...input.points].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt)
    || a.leftObservationId.localeCompare(b.leftObservationId)
    || a.rightObservationId.localeCompare(b.rightObservationId));

  const sampleSize = points.length;
  const correlation = sampleSize >= methodology.minimumSampleSize
    ? historicalRelationshipPearson(points)
    : undefined;
  const status: HistoricalRelationshipStatus =
    correlation === undefined ? "INSUFFICIENT_DATA" : "VALID";

  const withoutId = {
    version: "v1" as const,
    policy: HISTORICAL_RELATIONSHIP_POLICY_V1,
    status,
    methodology,
    sampleSize,
    ...(correlation === undefined ? {} : { correlation }),
    points,
    causalAttribution: "NOT_EVALUATED" as const,
  };
  return { id: "historical-relationship-v1-" + hash(withoutId), ...withoutId };
}
