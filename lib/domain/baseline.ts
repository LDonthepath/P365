import type { DataQuality, Observation } from "./types";

export type BaselineStatus = "VALID" | "STALE" | "MISSING" | "INCOMPATIBLE" | "UNKNOWN";

export type FactualBaseline = {
  kind: "FACTUAL";
  status: BaselineStatus;
  currentObservationId: string;
  baselineObservationId: string | null;
  currentValue: string;
  baselineValue: string | null;
  currentObservedAt: string;
  baselineObservedAt: string | null;
  sourceId: string;
  quality: DataQuality;
  reason?: string;
};

function metadataString(observation: Observation, key: string): string | null {
  const value = observation.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function observationSeriesId(observation: Observation): string | null {
  return metadataString(observation, "seriesId");
}

function observationDate(observation: Observation): string | null {
  const value = metadataString(observation, "observationDate");
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function compatible(a: Observation, b: Observation): boolean {
  if (a.domain !== b.domain || a.subject !== b.subject) return false;

  const aSeries = observationSeriesId(a);
  const bSeries = observationSeriesId(b);
  if (aSeries !== bSeries) return false;

  const aUnit = metadataString(a, "unit");
  const bUnit = metadataString(b, "unit");
  if (aUnit !== bUnit) return false;

  const aFrequency = metadataString(a, "frequency");
  const bFrequency = metadataString(b, "frequency");
  if (aFrequency !== bFrequency) return false;

  const aMeasurementDate = metadataString(a, "observationDate");
  const bMeasurementDate = metadataString(b, "observationDate");
  if (aMeasurementDate !== null || bMeasurementDate !== null) {
    if (observationDate(a) === null || observationDate(b) === null) return false;
  }

  return true;
}

function observedTime(observation: Observation): number | null {
  const value = Date.parse(observation.observedAt);
  return Number.isFinite(value) ? value : null;
}

function isEarlier(a: Observation, b: Observation): boolean {
  const aDate = observationDate(a);
  const bDate = observationDate(b);

  if (aDate && bDate && aDate !== bDate) return aDate < bDate;

  const aTime = observedTime(a);
  const bTime = observedTime(b);
  return aTime !== null && bTime !== null && aTime < bTime;
}

function baselineSortTime(observation: Observation): number {
  const date = observationDate(observation);
  if (date) return Date.parse(`${date}T00:00:00.000Z`);
  return observedTime(observation) ?? Number.NEGATIVE_INFINITY;
}

export function selectFactualBaseline(
  current: Observation,
  candidates: Observation[],
): FactualBaseline {
  const currentTime = observedTime(current);

  if (currentTime === null) {
    return {
      kind: "FACTUAL",
      status: "UNKNOWN",
      currentObservationId: current.id,
      baselineObservationId: null,
      currentValue: current.value,
      baselineValue: null,
      currentObservedAt: current.observedAt,
      baselineObservedAt: null,
      sourceId: current.sourceId,
      quality: "UNKNOWN",
      reason: "Current observation has an invalid observedAt timestamp.",
    };
  }

  const consideredCandidates = candidates.filter((candidate) => candidate.id !== current.id);
  const compatibleCandidates = consideredCandidates
    .filter((candidate) => compatible(current, candidate))
    .filter((candidate) => isEarlier(candidate, current))
    .sort((a, b) => baselineSortTime(b) - baselineSortTime(a));

  const baseline = compatibleCandidates[0];

  if (!baseline) {
    const hasCompatibleSeriesCandidates = consideredCandidates.some((candidate) => compatible(current, candidate));
    return {
      kind: "FACTUAL",
      status: hasCompatibleSeriesCandidates ? "MISSING" : consideredCandidates.length > 0 ? "INCOMPATIBLE" : "MISSING",
      currentObservationId: current.id,
      baselineObservationId: null,
      currentValue: current.value,
      baselineValue: null,
      currentObservedAt: current.observedAt,
      baselineObservedAt: null,
      sourceId: current.sourceId,
      quality: current.quality,
      reason: hasCompatibleSeriesCandidates
        ? "Compatible observations exist, but none precedes the current measurement.":
        consideredCandidates.length > 0
          ? "Candidate observations exist, but none is semantically compatible with the current observation."
          : "No candidate observations were supplied.",
    };
  }

  const status: BaselineStatus = baseline.quality === "STALE" ? "STALE" : "VALID";

  return {
    kind: "FACTUAL",
    status,
    currentObservationId: current.id,
    baselineObservationId: baseline.id,
    currentValue: current.value,
    baselineValue: baseline.value,
    currentObservedAt: current.observedAt,
    baselineObservedAt: baseline.observedAt,
    sourceId: current.sourceId,
    quality: baseline.quality,
    ...(status === "STALE" ? { reason: "Selected baseline observation is marked stale." } : {}),
  };
}

export function factualBaselineChange(baseline: FactualBaseline): number | null {
  if (baseline.status !== "VALID" || baseline.baselineValue === null) return null;

  const current = Number(baseline.currentValue);
  const previous = Number(baseline.baselineValue);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;

  return current - previous;
}
