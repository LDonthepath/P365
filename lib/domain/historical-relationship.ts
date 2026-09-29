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
  let correlation: number | undefined;
  if (sampleSize >= methodology.minimumSampleSize) {
    const lx = points.reduce((s, p) => s + p.leftValue, 0) / sampleSize;
    const ly = points.reduce((s, p) => s + p.rightValue, 0) / sampleSize;
    let covariance = 0, vx = 0, vy = 0;
    for (const p of points) {
      const dx = p.leftValue - lx;
      const dy = p.rightValue - ly;
      covariance += dx * dy; vx += dx * dx; vy += dy * dy;
    }
    if (vx > 0 && vy > 0) correlation = covariance / Math.sqrt(vx * vy);
  }
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
