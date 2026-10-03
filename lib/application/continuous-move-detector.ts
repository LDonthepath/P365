import { createHash } from "node:crypto";
import { historicalObservationFitnessEligible } from "../domain/historical-observation-fitness";
import type { Observation } from "../domain/types";
import { observationSemanticSeriesKey } from "../repositories/observation-history";
import type { HistoricalObservationRepository } from "../repositories/types";
import {
  CONTINUOUS_MOVE_CALIBRATION_V1,
  continuousMoveCalibrationSeries,
  type ContinuousMoveCalibrationSeriesKey,
} from "./continuous-move-calibration";

const CONTINUOUS_MOVE_HISTORY_LIMIT = 500;

export type ContinuousMoveDirection = "UP" | "DOWN" | "FLAT";

export type ContinuousMoveHorizonStatus =
  | "MATERIAL_MOVE"
  | "BELOW_MATERIALITY_THRESHOLD"
  | "INSUFFICIENT_DATA"
  | "INCOMPATIBLE"
  | "UNKNOWN";

export type ContinuousMoveHistoricalSample = {
  startObservationId: string;
  endObservationId: string;
  endObservedAt: string;
  magnitudePercent: number;
};

export type ContinuousMoveHorizonAssessment = {
  horizonMs: number;
  status: ContinuousMoveHorizonStatus;
  targetStartObservationId?: string;
  targetEndObservationId: string;
  targetStartObservedAt?: string;
  targetEndObservedAt: string;
  alignmentErrorMs?: number;
  direction?: ContinuousMoveDirection;
  signedPercentChange?: number;
  magnitudePercent?: number;
  materialityThresholdPercent?: number;
  targetPercentileRank?: number;
  historicalSampleSize: number;
  historicalSamples: ContinuousMoveHistoricalSample[];
  reason?: string;
};

export type ContinuousMoveAssessmentStatus =
  | "MATERIAL_MOVE"
  | "BELOW_MATERIALITY_THRESHOLD"
  | "INSUFFICIENT_DATA"
  | "INCOMPATIBLE"
  | "UNKNOWN";

export type ContinuousMoveAssessment = {
  id: string;
  version: "v1";
  policy: "continuous-market-move-detector-v1";
  methodologyId: typeof CONTINUOUS_MOVE_CALIBRATION_V1.methodologyId;
  methodologyVersion: typeof CONTINUOUS_MOVE_CALIBRATION_V1.methodologyVersion;
  seriesKey: ContinuousMoveCalibrationSeriesKey;
  sourceId: string;
  asOf: string;
  targetEndObservationId: string;
  targetEndObservedAt: string;
  status: ContinuousMoveAssessmentStatus;
  hasMaterialMove: boolean;
  horizons: ContinuousMoveHorizonAssessment[];
  causalAttribution: "NOT_EVALUATED";
};

function time(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numeric(observation: Observation): number | undefined {
  const parsed = Number(observation.value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function metadataString(observation: Observation, key: string): string | undefined {
  const value = observation.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function seriesKey(observation: Observation): string | undefined {
  return observation.identity?.seriesKey
    ?? observationSemanticSeriesKey(observation)
    ?? undefined;
}

function sameMeasurementMeaning(a: Observation, b: Observation): boolean {
  return a.domain === b.domain
    && seriesKey(a) === seriesKey(b)
    && metadataString(a, "unit") === metadataString(b, "unit")
    && metadataString(a, "frequency") === metadataString(b, "frequency");
}

function knownBy(observation: Observation, asOf: number): boolean {
  const retrievedAt = time(observation.retrievedAt);
  return retrievedAt !== undefined && retrievedAt <= asOf;
}

function latestByObservedTime(observations: Observation[]): Map<number, Observation> {
  const selected = new Map<number, Observation>();
  for (const observation of observations) {
    const observedAt = time(observation.observedAt);
    if (observedAt === undefined) continue;
    const existing = selected.get(observedAt);
    if (!existing
      || observation.retrievedAt > existing.retrievedAt
      || (observation.retrievedAt === existing.retrievedAt && observation.id > existing.id)) {
      selected.set(observedAt, observation);
    }
  }
  return selected;
}

function nearestObservation(
  observations: Map<number, Observation>,
  desiredAt: number,
  toleranceMs: number,
  beforeExclusive: number,
): { observation: Observation; observedAt: number; errorMs: number } | undefined {
  let selected:
    | { observation: Observation; observedAt: number; errorMs: number }
    | undefined;

  for (const [observedAt, observation] of observations) {
    if (observedAt >= beforeExclusive) continue;
    const errorMs = Math.abs(observedAt - desiredAt);
    if (errorMs > toleranceMs) continue;
    if (!selected
      || errorMs < selected.errorMs
      || (errorMs === selected.errorMs && observedAt > selected.observedAt)
      || (errorMs === selected.errorMs
        && observedAt === selected.observedAt
        && observation.id > selected.observation.id)) {
      selected = { observation, observedAt, errorMs };
    }
  }
  return selected;
}

function percentChange(start: number, end: number): number | undefined {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) return undefined;
  return ((end - start) / start) * 100;
}

/**
 * PostgreSQL percentile_cont-compatible linear interpolation.
 * The MOVE-001B calibration audit used percentile_cont, so runtime must preserve
 * the same deterministic threshold semantics.
 */
export function continuousPercentile(
  values: number[],
  percentile: number,
): number | undefined {
  if (!values.length || !Number.isFinite(percentile) || percentile < 0 || percentile > 100) {
    return undefined;
  }
  const ordered = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (ordered.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = ordered[lowerIndex];
  const upper = ordered[upperIndex];
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (index - lowerIndex);
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

function direction(change: number): ContinuousMoveDirection {
  if (change > 0) return "UP";
  if (change < 0) return "DOWN";
  return "FLAT";
}

function failureHorizon(input: {
  horizonMs: number;
  status: Exclude<
    ContinuousMoveHorizonStatus,
    "MATERIAL_MOVE" | "BELOW_MATERIALITY_THRESHOLD"
  >;
  targetEnd: Observation;
  reason: string;
  targetStart?: Observation;
  alignmentErrorMs?: number;
  historicalSampleSize?: number;
  historicalSamples?: ContinuousMoveHistoricalSample[];
}): ContinuousMoveHorizonAssessment {
  return {
    horizonMs: input.horizonMs,
    status: input.status,
    targetEndObservationId: input.targetEnd.id,
    targetEndObservedAt: input.targetEnd.observedAt,
    ...(input.targetStart
      ? {
          targetStartObservationId: input.targetStart.id,
          targetStartObservedAt: input.targetStart.observedAt,
        }
      : {}),
    ...(input.alignmentErrorMs === undefined
      ? {}
      : { alignmentErrorMs: input.alignmentErrorMs }),
    historicalSampleSize: input.historicalSampleSize ?? 0,
    historicalSamples: input.historicalSamples ?? [],
    reason: input.reason,
  };
}

function overallStatus(
  horizons: ContinuousMoveHorizonAssessment[],
): ContinuousMoveAssessmentStatus {
  if (horizons.some((item) => item.status === "MATERIAL_MOVE")) return "MATERIAL_MOVE";
  if (horizons.some((item) => item.status === "INCOMPATIBLE")) return "INCOMPATIBLE";
  if (horizons.some((item) => item.status === "UNKNOWN")) return "UNKNOWN";
  if (horizons.some((item) => item.status === "INSUFFICIENT_DATA")) {
    return "INSUFFICIENT_DATA";
  }
  return "BELOW_MATERIALITY_THRESHOLD";
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export async function detectContinuousMarketMove(input: {
  repository: HistoricalObservationRepository;
  seriesKey: ContinuousMoveCalibrationSeriesKey;
  targetEnd: Observation;
  asOf: string;
}): Promise<ContinuousMoveAssessment> {
  const policy = CONTINUOUS_MOVE_CALIBRATION_V1;
  const definition = continuousMoveCalibrationSeries(input.seriesKey);
  const asOf = time(input.asOf);
  const targetEndTime = time(input.targetEnd.observedAt);
  const targetEndValue = numeric(input.targetEnd);

  const globallyCompatible = asOf !== undefined
    && targetEndTime !== undefined
    && targetEndValue !== undefined
    && targetEndTime <= asOf
    && input.targetEnd.domain === definition.domain
    && seriesKey(input.targetEnd) === definition.seriesKey
    && input.targetEnd.sourceId === definition.sourceId
    && knownBy(input.targetEnd, asOf)
    && historicalObservationFitnessEligible(input.targetEnd);

  let horizons: ContinuousMoveHorizonAssessment[];

  if (!globallyCompatible) {
    horizons = policy.horizonsMs.map((horizonMs) => failureHorizon({
      horizonMs,
      status: "INCOMPATIBLE",
      targetEnd: input.targetEnd,
      reason: "Target Observation is not a compatible, point-in-time eligible MOVE target.",
    }));
  } else {
    horizons = await Promise.all(policy.horizonsMs.map(async (horizonMs) => {
      const queryFrom = targetEndTime
        - policy.lookbackMs
        - (2 * horizonMs)
        - (2 * policy.alignmentToleranceMs);

      let history: Observation[];
      try {
        history = await input.repository.findHistory({
          identity: {
            domain: definition.domain,
            seriesKey: definition.seriesKey,
          },
          sourceId: definition.sourceId,
          observedAtOnOrAfter: new Date(queryFrom).toISOString(),
          observedAtOnOrBefore: input.targetEnd.observedAt,
          retrievedAtOnOrBefore: input.asOf,
          order: "ASC",
          limit: CONTINUOUS_MOVE_HISTORY_LIMIT,
        });
      } catch {
        return failureHorizon({
          horizonMs,
          status: "UNKNOWN",
          targetEnd: input.targetEnd,
          reason: "Historical Observation repository read failed.",
        });
      }

      if (history.length >= CONTINUOUS_MOVE_HISTORY_LIMIT) {
        return failureHorizon({
          horizonMs,
          status: "UNKNOWN",
          targetEnd: input.targetEnd,
          reason: "Historical Observation query reached the bounded 500-row limit; complete calibration coverage is not proven.",
        });
      }

      const eligible = history.filter((observation) =>
        observation.domain === definition.domain
        && seriesKey(observation) === definition.seriesKey
        && observation.sourceId === definition.sourceId
        && knownBy(observation, asOf)
        && historicalObservationFitnessEligible(observation)
        && sameMeasurementMeaning(observation, input.targetEnd)
        && numeric(observation) !== undefined);

      const byObservedTime = latestByObservedTime(eligible);
      const selectedTargetEnd = byObservedTime.get(targetEndTime);
      if (!selectedTargetEnd || selectedTargetEnd.id !== input.targetEnd.id) {
        return failureHorizon({
          horizonMs,
          status: "INCOMPATIBLE",
          targetEnd: input.targetEnd,
          reason: "Target end Observation is not the latest knowable revision at its observedAt timestamp.",
        });
      }

      const targetStart = nearestObservation(
        byObservedTime,
        targetEndTime - horizonMs,
        policy.alignmentToleranceMs,
        targetEndTime,
      );
      if (!targetStart) {
        return failureHorizon({
          horizonMs,
          status: "INSUFFICIENT_DATA",
          targetEnd: input.targetEnd,
          reason: "No compatible target start Observation exists inside the calibrated alignment tolerance.",
        });
      }

      const targetStartValue = numeric(targetStart.observation)!;
      const signedPercentChange = percentChange(targetStartValue, targetEndValue);
      if (signedPercentChange === undefined) {
        return failureHorizon({
          horizonMs,
          status: "INCOMPATIBLE",
          targetEnd: input.targetEnd,
          targetStart: targetStart.observation,
          alignmentErrorMs: targetStart.errorMs,
          reason: "Target percentage change is undefined for the selected Observation values.",
        });
      }

      const historicalThroughExclusive = targetStart.observedAt;
      const historicalFrom = historicalThroughExclusive - policy.lookbackMs;
      const samples: ContinuousMoveHistoricalSample[] = [];

      const historicalEnds = [...byObservedTime.entries()]
        .filter(([observedAt]) =>
          observedAt >= historicalFrom && observedAt < historicalThroughExclusive)
        .sort(([a], [b]) => a - b);

      for (const [endObservedAt, endObservation] of historicalEnds) {
        const start = nearestObservation(
          byObservedTime,
          endObservedAt - horizonMs,
          policy.alignmentToleranceMs,
          endObservedAt,
        );
        if (!start) continue;
        const startValue = numeric(start.observation);
        const endValue = numeric(endObservation);
        if (startValue === undefined || endValue === undefined) continue;
        const signed = percentChange(startValue, endValue);
        if (signed === undefined) continue;
        samples.push({
          startObservationId: start.observation.id,
          endObservationId: endObservation.id,
          endObservedAt: endObservation.observedAt,
          magnitudePercent: Math.abs(signed),
        });
      }

      if (samples.length < policy.minimumSampleSize) {
        return failureHorizon({
          horizonMs,
          status: "INSUFFICIENT_DATA",
          targetEnd: input.targetEnd,
          targetStart: targetStart.observation,
          alignmentErrorMs: targetStart.errorMs,
          historicalSampleSize: samples.length,
          historicalSamples: samples,
          reason: "Eligible continuous-move historical samples are below minimumSampleSize.",
        });
      }

      const magnitudes = samples.map((sample) => sample.magnitudePercent);
      const threshold = continuousPercentile(
        magnitudes,
        policy.materialityPercentile,
      );
      if (threshold === undefined) {
        return failureHorizon({
          horizonMs,
          status: "UNKNOWN",
          targetEnd: input.targetEnd,
          targetStart: targetStart.observation,
          alignmentErrorMs: targetStart.errorMs,
          historicalSampleSize: samples.length,
          historicalSamples: samples,
          reason: "Continuous materiality percentile could not be calculated.",
        });
      }

      const magnitudePercent = Math.abs(signedPercentChange);
      return {
        horizonMs,
        status: magnitudePercent >= threshold
          ? "MATERIAL_MOVE"
          : "BELOW_MATERIALITY_THRESHOLD",
        targetStartObservationId: targetStart.observation.id,
        targetEndObservationId: input.targetEnd.id,
        targetStartObservedAt: targetStart.observation.observedAt,
        targetEndObservedAt: input.targetEnd.observedAt,
        alignmentErrorMs: targetStart.errorMs,
        direction: direction(signedPercentChange),
        signedPercentChange,
        magnitudePercent,
        materialityThresholdPercent: threshold,
        targetPercentileRank: percentileRank(magnitudes, magnitudePercent),
        historicalSampleSize: samples.length,
        historicalSamples: samples,
      };
    }));
  }

  const status = overallStatus(horizons);
  const withoutId = {
    version: "v1" as const,
    policy: "continuous-market-move-detector-v1" as const,
    methodologyId: policy.methodologyId,
    methodologyVersion: policy.methodologyVersion,
    seriesKey: input.seriesKey,
    sourceId: definition.sourceId,
    asOf: input.asOf,
    targetEndObservationId: input.targetEnd.id,
    targetEndObservedAt: input.targetEnd.observedAt,
    status,
    hasMaterialMove: status === "MATERIAL_MOVE",
    horizons,
    causalAttribution: "NOT_EVALUATED" as const,
  };

  return {
    id: "continuous-move-v1-" + hash(withoutId),
    ...withoutId,
  };
}
