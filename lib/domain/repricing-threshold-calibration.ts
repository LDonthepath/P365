import { createHash } from "node:crypto";
import type {
  HistoricalBaselineEvidence,
  HistoricalBaselineTransformation,
} from "./historical-baseline";

export const REPRICING_THRESHOLD_CALIBRATION_POLICY_V1 =
  "empirical-p90-repricing-threshold-calibration-v1" as const;

export const REPRICING_CALIBRATION_MIN_SAMPLE_SIZE_V1 = 100 as const;
export const REPRICING_CALIBRATION_CANDIDATE_PERCENTILE_V1 = 90 as const;

export type RepricingThresholdCalibrationStatus =
  | "CANDIDATE"
  | "INSUFFICIENT_DATA"
  | "INCOMPATIBLE"
  | "UNKNOWN";

export type RepricingThresholdCalibrationInput = {
  observationKey: string;
  seriesKey: string;
  sourceId: string;
  comparisonHorizonMs: number;
  historicalBaseline: HistoricalBaselineEvidence;
};

export type RepricingThresholdCalibrationEvidence = {
  id: string;
  version: "v1";
  policy: typeof REPRICING_THRESHOLD_CALIBRATION_POLICY_V1;
  status: RepricingThresholdCalibrationStatus;
  observationKey: string;
  seriesKey: string;
  sourceId: string;
  comparisonHorizonMs: number;
  transformation: HistoricalBaselineTransformation;
  historicalBaselineId: string;
  historicalMethodologyId: string;
  historicalMethodologyVersion: string;
  historicalAsOf: string;
  sampleSize: number;
  minimumSampleSize: typeof REPRICING_CALIBRATION_MIN_SAMPLE_SIZE_V1;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  candidateThreshold: {
    basis: "ABSOLUTE_PERCENT_CHANGE";
    percentile: typeof REPRICING_CALIBRATION_CANDIDATE_PERCENTILE_V1;
    minimumMagnitude: number;
  } | null;
  causalAttribution: "NOT_EVALUATED";
  reason?: string;
};

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function percentileCont(values: number[], percentile: number): number {
  if (values.length === 0) {
    throw new Error("RPR-002A percentile calculation requires at least one sample.");
  }
  if (!Number.isFinite(percentile) || percentile < 0 || percentile > 1) {
    throw new Error("RPR-002A percentile must be between zero and one.");
  }

  const ordered = [...values].sort((a, b) => a - b);
  const index = (ordered.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = ordered[lowerIndex];
  const upper = ordered[upperIndex];
  if (lower === undefined || upper === undefined) {
    throw new Error("RPR-002A percentile index is outside the sample set.");
  }
  if (lowerIndex === upperIndex) return lower;

  return lower + (upper - lower) * (index - lowerIndex);
}

function finish(
  evidence: Omit<RepricingThresholdCalibrationEvidence, "id">,
): RepricingThresholdCalibrationEvidence {
  return {
    id: "repricing-threshold-calibration-v1-" + stableHash(evidence),
    ...evidence,
  };
}

function failClosed(
  input: RepricingThresholdCalibrationInput,
  status: Exclude<RepricingThresholdCalibrationStatus, "CANDIDATE">,
  reason: string,
): RepricingThresholdCalibrationEvidence {
  const baseline = input.historicalBaseline;
  return finish({
    version: "v1",
    policy: REPRICING_THRESHOLD_CALIBRATION_POLICY_V1,
    status,
    observationKey: input.observationKey,
    seriesKey: input.seriesKey,
    sourceId: input.sourceId,
    comparisonHorizonMs: input.comparisonHorizonMs,
    transformation: baseline.methodology.transformation,
    historicalBaselineId: baseline.id,
    historicalMethodologyId: baseline.methodology.methodologyId,
    historicalMethodologyVersion: baseline.methodology.methodologyVersion,
    historicalAsOf: baseline.methodology.asOf,
    sampleSize: baseline.sampleSize,
    minimumSampleSize: REPRICING_CALIBRATION_MIN_SAMPLE_SIZE_V1,
    p50: null,
    p75: null,
    p90: null,
    p95: null,
    candidateThreshold: null,
    causalAttribution: "NOT_EVALUATED",
    reason,
  });
}

/**
 * RPR-002A converts one already-qualified HIST-001 historical distribution into
 * an empirical P90 threshold candidate for owner review.
 *
 * It does not feed RPR-001, classify repricing, freeze a production threshold,
 * infer causality, or activate any dashboard/briefing runtime.
 */
export function calibrateRepricingThresholdCandidate(
  input: RepricingThresholdCalibrationInput,
): RepricingThresholdCalibrationEvidence {
  if (!input.observationKey.trim() || !input.seriesKey.trim() || !input.sourceId.trim()) {
    throw new Error("RPR-002A requires observation, series, and source identity.");
  }
  if (!Number.isInteger(input.comparisonHorizonMs) || input.comparisonHorizonMs <= 0) {
    throw new Error("RPR-002A requires a positive integer comparison horizon.");
  }

  const baseline = input.historicalBaseline;
  const methodology = baseline.methodology;
  if (
    methodology.identity.seriesKey !== input.seriesKey
    || methodology.sourceId !== input.sourceId
    || methodology.comparisonHorizonMs !== input.comparisonHorizonMs
  ) {
    return failClosed(
      input,
      "INCOMPATIBLE",
      "Historical baseline identity/source/horizon does not match the calibration request.",
    );
  }

  if (methodology.transformation !== "ABSOLUTE_PERCENT_CHANGE") {
    return failClosed(
      input,
      "INCOMPATIBLE",
      "RPR-002A v1 requires ABSOLUTE_PERCENT_CHANGE historical samples.",
    );
  }

  if (baseline.status === "UNKNOWN") {
    return failClosed(
      input,
      "UNKNOWN",
      baseline.reason ?? "Historical distribution is unavailable.",
    );
  }
  if (baseline.status === "INCOMPATIBLE") {
    return failClosed(
      input,
      "INCOMPATIBLE",
      baseline.reason ?? "Historical distribution is incompatible.",
    );
  }
  if (
    baseline.status !== "VALID"
    || baseline.sampleSize < REPRICING_CALIBRATION_MIN_SAMPLE_SIZE_V1
  ) {
    return failClosed(
      input,
      "INSUFFICIENT_DATA",
      "RPR-002A requires at least 100 qualified exact-horizon samples before a P90 candidate can be produced.",
    );
  }

  if (baseline.samples.length !== baseline.sampleSize) {
    return failClosed(
      input,
      "INCOMPATIBLE",
      "Historical baseline sampleSize does not match its explicit sample lineage.",
    );
  }

  const values = baseline.samples.map((sample) => sample.value);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return failClosed(
      input,
      "INCOMPATIBLE",
      "RPR-002A requires finite non-negative absolute percentage-change samples.",
    );
  }

  const p50 = percentileCont(values, 0.50);
  const p75 = percentileCont(values, 0.75);
  const p90 = percentileCont(values, 0.90);
  const p95 = percentileCont(values, 0.95);

  return finish({
    version: "v1",
    policy: REPRICING_THRESHOLD_CALIBRATION_POLICY_V1,
    status: "CANDIDATE",
    observationKey: input.observationKey,
    seriesKey: input.seriesKey,
    sourceId: input.sourceId,
    comparisonHorizonMs: input.comparisonHorizonMs,
    transformation: methodology.transformation,
    historicalBaselineId: baseline.id,
    historicalMethodologyId: methodology.methodologyId,
    historicalMethodologyVersion: methodology.methodologyVersion,
    historicalAsOf: methodology.asOf,
    sampleSize: baseline.sampleSize,
    minimumSampleSize: REPRICING_CALIBRATION_MIN_SAMPLE_SIZE_V1,
    p50,
    p75,
    p90,
    p95,
    candidateThreshold: {
      basis: "ABSOLUTE_PERCENT_CHANGE",
      percentile: REPRICING_CALIBRATION_CANDIDATE_PERCENTILE_V1,
      minimumMagnitude: p90,
    },
    causalAttribution: "NOT_EVALUATED",
  });
}
