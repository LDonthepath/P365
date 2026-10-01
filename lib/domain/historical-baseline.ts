import { createHash } from "node:crypto";
import type { DataQuality } from "./types";
import type { ObservationHistoryIdentity } from "../repositories/types";

export const HISTORICAL_BASELINE_POLICY_V1 = "point-in-time-historical-baseline-v1" as const;

export type HistoricalBaselineTransformation =
  | "LEVEL"
  | "ABSOLUTE_CHANGE"
  | "PERCENT_CHANGE"
  | "ABSOLUTE_PERCENT_CHANGE";

export type HistoricalBaselineStatus =
  | "VALID"
  | "INSUFFICIENT_DATA"
  | "INCOMPATIBLE"
  | "UNKNOWN";

export type HistoricalBaselineMethodology = {
  methodologyId: string;
  methodologyVersion: string;
  identity: ObservationHistoryIdentity;
  sourceId?: string;
  transformation: HistoricalBaselineTransformation;
  observedAtOnOrAfter: string;
  observedAtOnOrBefore: string;
  asOf: string;
  minimumSampleSize: number;
  comparisonHorizonMs?: number;
};

export type HistoricalBaselineSample = {
  observedAt: string;
  startObservationId?: string;
  endObservationId: string;
  value: number;
};

export type HistoricalBaselineEvidence = {
  id: string;
  version: "v1";
  policy: typeof HISTORICAL_BASELINE_POLICY_V1;
  status: HistoricalBaselineStatus;
  methodology: HistoricalBaselineMethodology;
  targetObservationIds: string[];
  targetObservationQualities: DataQuality[];
  targetValue?: number;
  sampleSize: number;
  samples: HistoricalBaselineSample[];
  minimum?: number;
  maximum?: number;
  median?: number;
  percentileRank?: number;
  reason?: string;
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`HIST-001B requires valid ${field}.`);
  return parsed;
}

function validateMethodology(methodology: HistoricalBaselineMethodology): void {
  if (!methodology.methodologyId.trim() || !methodology.methodologyVersion.trim()) {
    throw new Error("HIST-001B requires explicit methodology identity and version.");
  }
  if (!methodology.identity.seriesKey.trim()) {
    throw new Error("HIST-001B requires a non-empty seriesKey.");
  }
  if (methodology.sourceId !== undefined && !methodology.sourceId.trim()) {
    throw new Error("HIST-001B sourceId must be non-empty when supplied.");
  }
  const from = timestamp(methodology.observedAtOnOrAfter, "observedAtOnOrAfter");
  const through = timestamp(methodology.observedAtOnOrBefore, "observedAtOnOrBefore");
  timestamp(methodology.asOf, "asOf");
  if (from > through) {
    throw new Error("HIST-001B requires an ordered historical observation window.");
  }
  if (!Number.isInteger(methodology.minimumSampleSize) || methodology.minimumSampleSize < 1) {
    throw new Error("HIST-001B minimumSampleSize must be an integer >= 1.");
  }

  const needsHorizon = methodology.transformation !== "LEVEL";
  if (needsHorizon) {
    if (!Number.isInteger(methodology.comparisonHorizonMs) || (methodology.comparisonHorizonMs ?? 0) <= 0) {
      throw new Error("HIST-001B change transformations require a positive integer comparisonHorizonMs.");
    }
  } else if (methodology.comparisonHorizonMs !== undefined) {
    throw new Error("HIST-001B LEVEL must not declare comparisonHorizonMs.");
  }
}

function median(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function percentileRank(values: number[], target: number): number {
  let less = 0;
  let equal = 0;
  for (const value of values) {
    if (value < target) less += 1;
    else if (value === target) equal += 1;
  }
  return 100 * (less + 0.5 * equal) / values.length;
}

export function buildHistoricalBaselineEvidence(input: {
  methodology: HistoricalBaselineMethodology;
  targetObservationIds: string[];
  targetObservationQualities: DataQuality[];
  targetValue?: number;
  samples: HistoricalBaselineSample[];
  statusOverride?: Exclude<HistoricalBaselineStatus, "VALID">;
  reason?: string;
}): HistoricalBaselineEvidence {
  validateMethodology(input.methodology);

  const targetObservationIds = [...input.targetObservationIds];
  const targetObservationQualities = [...input.targetObservationQualities];
  const samples = [...input.samples].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt)
    || (a.startObservationId ?? "").localeCompare(b.startObservationId ?? "")
    || a.endObservationId.localeCompare(b.endObservationId));

  for (const sample of samples) {
    timestamp(sample.observedAt, "sample observedAt");
    if (!Number.isFinite(sample.value)) throw new Error("HIST-001B sample values must be finite.");
  }
  if (input.targetValue !== undefined && !Number.isFinite(input.targetValue)) {
    throw new Error("HIST-001B targetValue must be finite when supplied.");
  }

  let status: HistoricalBaselineStatus;
  let minimum: number | undefined;
  let maximum: number | undefined;
  let sampleMedian: number | undefined;
  let rank: number | undefined;

  if (input.statusOverride) {
    status = input.statusOverride;
  } else if (input.targetValue === undefined || samples.length < input.methodology.minimumSampleSize) {
    status = "INSUFFICIENT_DATA";
  } else {
    const values = samples.map((sample) => sample.value);
    status = "VALID";
    minimum = Math.min(...values);
    maximum = Math.max(...values);
    sampleMedian = median(values);
    rank = percentileRank(values, input.targetValue);
  }

  const withoutId = {
    version: "v1" as const,
    policy: HISTORICAL_BASELINE_POLICY_V1,
    status,
    methodology: input.methodology,
    targetObservationIds,
    targetObservationQualities,
    ...(input.targetValue === undefined ? {} : { targetValue: input.targetValue }),
    sampleSize: samples.length,
    samples,
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
    ...(sampleMedian === undefined ? {} : { median: sampleMedian }),
    ...(rank === undefined ? {} : { percentileRank: rank }),
    ...(input.reason ? { reason: input.reason } : {}),
  };

  return {
    id: "historical-baseline-v1-" + hash(withoutId),
    ...withoutId,
  };
}
