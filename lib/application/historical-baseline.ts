import type { Observation } from "../domain/types";
import {
  buildHistoricalBaselineEvidence,
  type HistoricalBaselineEvidence,
  type HistoricalBaselineMethodology,
  type HistoricalBaselineSample,
  type HistoricalBaselineTransformation,
} from "../domain/historical-baseline";
import { observationSemanticSeriesKey } from "../repositories/observation-history";
import type { HistoricalObservationRepository } from "../repositories/types";

const HISTORICAL_BASELINE_HISTORY_LIMIT = 500;

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
  return observation.identity?.seriesKey ?? observationSemanticSeriesKey(observation) ?? undefined;
}

function sameMeasurementMeaning(a: Observation, b: Observation): boolean {
  return a.domain === b.domain
    && seriesKey(a) === seriesKey(b)
    && metadataString(a, "unit") === metadataString(b, "unit")
    && metadataString(a, "frequency") === metadataString(b, "frequency");
}

function targetMatchesMethodology(
  observation: Observation,
  methodology: HistoricalBaselineMethodology,
): boolean {
  if (observation.domain !== methodology.identity.domain) return false;
  if (seriesKey(observation) !== methodology.identity.seriesKey) return false;
  if (methodology.sourceId && observation.sourceId !== methodology.sourceId) return false;
  return true;
}

function knownBy(observation: Observation, asOf: number): boolean {
  const retrievedAt = time(observation.retrievedAt);
  return retrievedAt !== undefined && retrievedAt <= asOf;
}

function historicalQualityEligible(observation: Observation): boolean {
  return observation.quality === "FRESH" || observation.quality === "STALE";
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

function transformedValue(
  transformation: HistoricalBaselineTransformation,
  startValue: number | undefined,
  endValue: number,
): number | undefined {
  if (transformation === "LEVEL") return endValue;
  if (startValue === undefined) return undefined;
  if (transformation === "ABSOLUTE_CHANGE") return endValue - startValue;
  if (startValue === 0) return undefined;
  const percent = ((endValue - startValue) / startValue) * 100;
  return transformation === "PERCENT_CHANGE" ? percent : Math.abs(percent);
}

function failureEvidence(input: {
  methodology: HistoricalBaselineMethodology;
  targetObservations: Observation[];
  status: "INCOMPATIBLE" | "UNKNOWN" | "INSUFFICIENT_DATA";
  reason: string;
  targetValue?: number;
}): HistoricalBaselineEvidence {
  return buildHistoricalBaselineEvidence({
    methodology: input.methodology,
    targetObservationIds: input.targetObservations.map((observation) => observation.id),
    targetObservationQualities: input.targetObservations.map((observation) => observation.quality),
    ...(input.targetValue === undefined ? {} : { targetValue: input.targetValue }),
    samples: [],
    statusOverride: input.status,
    reason: input.reason,
  });
}

function prepareTarget(input: {
  methodology: HistoricalBaselineMethodology;
  targetEnd: Observation;
  targetStart?: Observation;
}):
  | { ok: true; targetObservations: Observation[]; targetValue: number }
  | { ok: false; evidence: HistoricalBaselineEvidence } {
  const { methodology, targetEnd, targetStart } = input;
  const asOf = time(methodology.asOf);
  const targetEndTime = time(targetEnd.observedAt);
  const historicalThrough = time(methodology.observedAtOnOrBefore);
  if (asOf === undefined || targetEndTime === undefined || historicalThrough === undefined) {
    throw new Error("HIST-001B methodology and target timestamps must be valid.");
  }

  const targetObservations = targetStart ? [targetStart, targetEnd] : [targetEnd];

  if (!targetMatchesMethodology(targetEnd, methodology)
    || (targetStart && !targetMatchesMethodology(targetStart, methodology))) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INCOMPATIBLE",
        reason: "Target Observation identity/source does not match the historical-baseline methodology.",
      }),
    };
  }

  if (!knownBy(targetEnd, asOf) || (targetStart && !knownBy(targetStart, asOf))) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "UNKNOWN",
        reason: "Target Observation was not knowable by the requested asOf cutoff.",
      }),
    };
  }

  if (targetEnd.quality === "UNKNOWN" || targetEnd.quality === "PARTIAL"
    || (targetStart && (targetStart.quality === "UNKNOWN" || targetStart.quality === "PARTIAL"))) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "UNKNOWN",
        reason: "Target Observation quality is insufficient for historical-baseline comparison.",
      }),
    };
  }

  if (historicalThrough >= targetEndTime) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INCOMPATIBLE",
        reason: "Historical window must end strictly before the target end Observation.",
      }),
    };
  }

  const endValue = numeric(targetEnd);
  if (endValue === undefined) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INCOMPATIBLE",
        reason: "Target Observation value is not finite numeric data.",
      }),
    };
  }

  if (methodology.transformation === "LEVEL") {
    if (targetStart) {
      return {
        ok: false,
        evidence: failureEvidence({
          methodology,
          targetObservations,
          status: "INCOMPATIBLE",
          reason: "LEVEL historical baseline accepts only one target Observation.",
        }),
      };
    }
    return { ok: true, targetObservations, targetValue: endValue };
  }

  if (!targetStart) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INSUFFICIENT_DATA",
        reason: "Change-based historical baseline requires an explicit target start Observation.",
      }),
    };
  }

  const targetStartTime = time(targetStart.observedAt);
  if (targetStartTime === undefined || targetStartTime >= targetEndTime) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INCOMPATIBLE",
        reason: "Target start Observation must precede the target end Observation.",
      }),
    };
  }

  if (!sameMeasurementMeaning(targetStart, targetEnd)) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INCOMPATIBLE",
        reason: "Target start/end Observations are not semantically compatible.",
      }),
    };
  }

  if (targetEndTime - targetStartTime !== methodology.comparisonHorizonMs) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INCOMPATIBLE",
        reason: "Target start/end Observations do not match comparisonHorizonMs.",
      }),
    };
  }

  const startValue = numeric(targetStart);
  if (startValue === undefined) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INCOMPATIBLE",
        reason: "Target start Observation value is not finite numeric data.",
      }),
    };
  }

  const targetValue = transformedValue(methodology.transformation, startValue, endValue);
  if (targetValue === undefined) {
    return {
      ok: false,
      evidence: failureEvidence({
        methodology,
        targetObservations,
        status: "INCOMPATIBLE",
        reason: "Target transformation is undefined for the supplied values.",
      }),
    };
  }

  return { ok: true, targetObservations, targetValue };
}

export async function measureRepositoryBackedHistoricalBaseline(input: {
  methodology: HistoricalBaselineMethodology;
  repository: HistoricalObservationRepository;
  targetEnd: Observation;
  targetStart?: Observation;
}): Promise<HistoricalBaselineEvidence> {
  const prepared = prepareTarget(input);
  if (!prepared.ok) return prepared.evidence;

  const from = time(input.methodology.observedAtOnOrAfter);
  const through = time(input.methodology.observedAtOnOrBefore);
  if (from === undefined || through === undefined) {
    throw new Error("HIST-001B historical window timestamps must be valid.");
  }

  const horizon = input.methodology.comparisonHorizonMs ?? 0;
  const queryFrom = input.methodology.transformation === "LEVEL"
    ? from
    : from - horizon;
  if (!Number.isFinite(queryFrom)) {
    throw new Error("HIST-001B historical query lower bound is invalid.");
  }

  let history: Observation[];
  try {
    history = await input.repository.findHistory({
      identity: input.methodology.identity,
      ...(input.methodology.sourceId ? { sourceId: input.methodology.sourceId } : {}),
      observedAtOnOrAfter: new Date(queryFrom).toISOString(),
      observedAtOnOrBefore: input.methodology.observedAtOnOrBefore,
      retrievedAtOnOrBefore: input.methodology.asOf,
      order: "ASC",
      limit: HISTORICAL_BASELINE_HISTORY_LIMIT,
    });
  } catch {
    return failureEvidence({
      methodology: input.methodology,
      targetObservations: prepared.targetObservations,
      targetValue: prepared.targetValue,
      status: "UNKNOWN",
      reason: "Historical Observation repository read failed; historical baseline is unavailable.",
    });
  }

  if (history.length >= HISTORICAL_BASELINE_HISTORY_LIMIT) {
    return failureEvidence({
      methodology: input.methodology,
      targetObservations: prepared.targetObservations,
      targetValue: prepared.targetValue,
      status: "UNKNOWN",
      reason: "Historical Observation query reached the bounded repository limit; complete window coverage is not proven.",
    });
  }

  const asOf = time(input.methodology.asOf)!;
  const targetEnd = input.targetEnd;
  const eligible = history.filter((observation) =>
    targetMatchesMethodology(observation, input.methodology)
    && knownBy(observation, asOf)
    && historicalQualityEligible(observation)
    && sameMeasurementMeaning(observation, targetEnd)
    && !prepared.targetObservations.some((target) => target.id === observation.id));

  const byObservedTime = latestByObservedTime(eligible);
  const samples: HistoricalBaselineSample[] = [];

  const endCandidates = [...byObservedTime.entries()]
    .filter(([observedAt]) => observedAt >= from && observedAt <= through)
    .sort(([a], [b]) => a - b);

  for (const [observedAt, endObservation] of endCandidates) {
    const endValue = numeric(endObservation);
    if (endValue === undefined) continue;

    if (input.methodology.transformation === "LEVEL") {
      samples.push({
        observedAt: endObservation.observedAt,
        endObservationId: endObservation.id,
        value: endValue,
      });
      continue;
    }

    const startObservation = byObservedTime.get(observedAt - horizon);
    if (!startObservation) continue;
    if (!sameMeasurementMeaning(startObservation, endObservation)) continue;
    const startValue = numeric(startObservation);
    if (startValue === undefined) continue;
    const value = transformedValue(input.methodology.transformation, startValue, endValue);
    if (value === undefined) continue;

    samples.push({
      observedAt: endObservation.observedAt,
      startObservationId: startObservation.id,
      endObservationId: endObservation.id,
      value,
    });
  }

  return buildHistoricalBaselineEvidence({
    methodology: input.methodology,
    targetObservationIds: prepared.targetObservations.map((observation) => observation.id),
    targetObservationQualities: prepared.targetObservations.map((observation) => observation.quality),
    targetValue: prepared.targetValue,
    samples,
    ...(samples.length < input.methodology.minimumSampleSize
      ? { reason: "Eligible historical samples are below minimumSampleSize." }
      : {}),
  });
}
