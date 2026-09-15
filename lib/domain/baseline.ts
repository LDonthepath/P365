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

function observationSeriesId(observation: Observation): string | null {
  const value = observation.metadata?.seriesId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function compatible(a: Observation, b: Observation): boolean {
  const aSeries = observationSeriesId(a);
  const bSeries = observationSeriesId(b);
  if (aSeries && bSeries && aSeries !== bSeries) return false;

  const aUnit = a.metadata?.unit;
  const bUnit = b.metadata?.unit;
  if (aUnit && bUnit && aUnit !== bUnit) return false;

  const aFrequency = a.metadata?.frequency;
  const bFrequency = b.metadata?.frequency;
  if (aFrequency && bFrequency && aFrequency !== bFrequency) return false;

  return a.domain === b.domain && a.subject === b.subject;
}

function observedTime(observation: Observation): number | null {
  const value = Date.parse(observation.observedAt);
  return Number.isFinite(value) ? value : null;
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

  const compatibleCandidates = candidates
    .filter((candidate) => candidate.id !== current.id)
    .filter((candidate) => compatible(current, candidate))
    .map((candidate) => ({ candidate, time: observedTime(candidate) }))
    .filter((item): item is { candidate: Observation; time: number } => item.time !== null)
    .filter((item) => item.time < currentTime)
    .sort((a, b) => b.time - a.time);

  const baseline = compatibleCandidates[0]?.candidate;

  if (!baseline) {
    return {
      kind: "FACTUAL",
      status: "MISSING",
      currentObservationId: current.id,
      baselineObservationId: null,
      currentValue: current.value,
      baselineValue: null,
      currentObservedAt: current.observedAt,
      baselineObservedAt: null,
      sourceId: current.sourceId,
      quality: current.quality,
      reason: "No earlier compatible valid observation was found.",
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
