import { createHash } from "node:crypto";
import type { EventWindowRole } from "./event-window";

export const TRANSMISSION_DIRECTION_CALIBRATION_POLICY_V1 =
  "event-window-directional-binomial-calibration-v1" as const;

export const TRANSMISSION_DIRECTION_CALIBRATION_MIN_SAMPLE_SIZE_V1 = 30 as const;
export const TRANSMISSION_DIRECTION_CALIBRATION_SIGNIFICANCE_V1 = 0.05 as const;

export type TransmissionDirectionRelation =
  | "SAME_DIRECTION"
  | "OPPOSITE_DIRECTION";

export type TransmissionDirectionCalibrationSampleInput = {
  sampleId: string;
  driverPercentChange: number;
  responsePercentChange: number;
  comparisonIds: string[];
  eventIdentityKeys: string[];
};

export type TransmissionDirectionCalibrationSample = {
  sampleId: string;
  driverPercentChange: number;
  responsePercentChange: number;
  observedRelation: TransmissionDirectionRelation;
  comparisonIds: string[];
  eventIdentityKeys: string[];
};

export type TransmissionDirectionCalibrationStatus =
  | "CANDIDATE"
  | "NO_STABLE_RELATIONSHIP"
  | "INSUFFICIENT_DATA";

export type TransmissionDirectionCalibrationEvidence = {
  id: string;
  version: "v1";
  policy: typeof TRANSMISSION_DIRECTION_CALIBRATION_POLICY_V1;
  status: TransmissionDirectionCalibrationStatus;
  driverObservationKey: string;
  responseObservationKey: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  transformation: "SIGNED_PERCENT_CHANGE";
  methodologyId: string;
  methodologyVersion: string;
  minimumSampleSize: typeof TRANSMISSION_DIRECTION_CALIBRATION_MIN_SAMPLE_SIZE_V1;
  significanceLevel: typeof TRANSMISSION_DIRECTION_CALIBRATION_SIGNIFICANCE_V1;
  sampleSize: number;
  sameDirectionCount: number;
  oppositeDirectionCount: number;
  sameDirectionShare: number | null;
  oppositeDirectionShare: number | null;
  exactTwoSidedPValue: number | null;
  candidateExpectedRelation: TransmissionDirectionRelation | null;
  samples: TransmissionDirectionCalibrationSample[];
  causalAttribution: "NOT_EVALUATED";
  reason?: string;
};

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function exactTwoSidedBinomialPValue(successes: number, trials: number): number {
  if (!Number.isInteger(successes) || !Number.isInteger(trials)) {
    throw new Error("TRN-002A binomial inputs must be integers.");
  }
  if (trials < 1 || successes < 0 || successes > trials) {
    throw new Error("TRN-002A binomial inputs are outside their valid range.");
  }

  const tail = Math.min(successes, trials - successes);
  let combination = 1;
  let cumulative = Math.pow(0.5, trials);

  for (let k = 1; k <= tail; k += 1) {
    combination *= (trials - (k - 1)) / k;
    cumulative += combination * Math.pow(0.5, trials);
  }

  return Math.min(1, 2 * cumulative);
}

function finish(
  evidence: Omit<TransmissionDirectionCalibrationEvidence, "id">,
): TransmissionDirectionCalibrationEvidence {
  return {
    id: "transmission-direction-calibration-v1-" + stableHash(evidence),
    ...evidence,
  };
}

/**
 * TRN-002A calibrates one horizon-specific directional relationship from
 * already-built, point-in-time event-window samples.
 *
 * It does not create a production TRN-001 rule. A candidate direction is
 * produced only when the directional sample count reaches 30 and the majority
 * relation differs from a 50/50 null under a two-sided exact binomial test at
 * p <= 0.05.
 */
export function calibrateTransmissionDirection(input: {
  driverObservationKey: string;
  responseObservationKey: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  methodologyId: string;
  methodologyVersion: string;
  samples: TransmissionDirectionCalibrationSampleInput[];
}): TransmissionDirectionCalibrationEvidence {
  const driverObservationKey = input.driverObservationKey.trim();
  const responseObservationKey = input.responseObservationKey.trim();
  const methodologyId = input.methodologyId.trim();
  const methodologyVersion = input.methodologyVersion.trim();

  if (!driverObservationKey || !responseObservationKey) {
    throw new Error("TRN-002A requires non-empty driver and response Observation keys.");
  }
  if (driverObservationKey === responseObservationKey) {
    throw new Error("TRN-002A driver and response Observation keys must differ.");
  }
  if (!methodologyId || !methodologyVersion) {
    throw new Error("TRN-002A requires explicit methodology identity and version.");
  }

  const sampleIds = new Set<string>();
  const samples = input.samples.map((sample): TransmissionDirectionCalibrationSample => {
    const sampleId = sample.sampleId.trim();
    if (!sampleId) {
      throw new Error("TRN-002A sampleId must be non-empty.");
    }
    if (sampleIds.has(sampleId)) {
      throw new Error("TRN-002A sample IDs must be unique.");
    }
    sampleIds.add(sampleId);

    if (
      !Number.isFinite(sample.driverPercentChange)
      || !Number.isFinite(sample.responsePercentChange)
      || sample.driverPercentChange === 0
      || sample.responsePercentChange === 0
    ) {
      throw new Error(
        "TRN-002A directional samples require finite non-zero signed percentage changes.",
      );
    }

    const observedRelation =
      Math.sign(sample.driverPercentChange) === Math.sign(sample.responsePercentChange)
        ? "SAME_DIRECTION"
        : "OPPOSITE_DIRECTION";

    return {
      sampleId,
      driverPercentChange: sample.driverPercentChange,
      responsePercentChange: sample.responsePercentChange,
      observedRelation,
      comparisonIds: sortedUnique(sample.comparisonIds),
      eventIdentityKeys: sortedUnique(sample.eventIdentityKeys),
    };
  }).sort((a, b) => a.sampleId.localeCompare(b.sampleId));

  const sampleSize = samples.length;
  const sameDirectionCount = samples.filter(
    (sample) => sample.observedRelation === "SAME_DIRECTION",
  ).length;
  const oppositeDirectionCount = samples.filter(
    (sample) => sample.observedRelation === "OPPOSITE_DIRECTION",
  ).length;
  const sameDirectionShare = sampleSize > 0
    ? sameDirectionCount / sampleSize
    : null;
  const oppositeDirectionShare = sampleSize > 0
    ? oppositeDirectionCount / sampleSize
    : null;

  const pValue = sampleSize > 0
    ? exactTwoSidedBinomialPValue(
        Math.max(sameDirectionCount, oppositeDirectionCount),
        sampleSize,
      )
    : null;

  let status: TransmissionDirectionCalibrationStatus;
  let candidateExpectedRelation: TransmissionDirectionRelation | null = null;
  let reason: string | undefined;

  if (sampleSize < TRANSMISSION_DIRECTION_CALIBRATION_MIN_SAMPLE_SIZE_V1) {
    status = "INSUFFICIENT_DATA";
    reason =
      "TRN-002A requires at least 30 unique directional event-window cohorts before a production relationship candidate can be produced.";
  } else if (
    pValue === null
    || pValue > TRANSMISSION_DIRECTION_CALIBRATION_SIGNIFICANCE_V1
    || sameDirectionCount === oppositeDirectionCount
  ) {
    status = "NO_STABLE_RELATIONSHIP";
    reason =
      "The historical directional relationship does not differ significantly from a 50/50 same-vs-opposite null at the frozen significance level.";
  } else {
    status = "CANDIDATE";
    candidateExpectedRelation =
      sameDirectionCount > oppositeDirectionCount
        ? "SAME_DIRECTION"
        : "OPPOSITE_DIRECTION";
  }

  return finish({
    version: "v1",
    policy: TRANSMISSION_DIRECTION_CALIBRATION_POLICY_V1,
    status,
    driverObservationKey,
    responseObservationKey,
    afterRole: input.afterRole,
    transformation: "SIGNED_PERCENT_CHANGE",
    methodologyId,
    methodologyVersion,
    minimumSampleSize: TRANSMISSION_DIRECTION_CALIBRATION_MIN_SAMPLE_SIZE_V1,
    significanceLevel: TRANSMISSION_DIRECTION_CALIBRATION_SIGNIFICANCE_V1,
    sampleSize,
    sameDirectionCount,
    oppositeDirectionCount,
    sameDirectionShare,
    oppositeDirectionShare,
    exactTwoSidedPValue: pValue,
    candidateExpectedRelation,
    samples,
    causalAttribution: "NOT_EVALUATED",
    ...(reason ? { reason } : {}),
  });
}
