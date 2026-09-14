import type { Confidence, Observation, State } from "./types";

export function buildState(input: {
  id: string;
  domain: string;
  value: string;
  observations: Observation[];
  confidence?: Confidence;
  evaluatedAt?: string;
}): State {
  return {
    id: input.id,
    domain: input.domain,
    value: input.value,
    confidence: input.confidence ?? confidenceFromObservations(input.observations),
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    evidenceIds: input.observations.map((item) => item.evidenceId),
  };
}

export function confidenceFromObservations(observations: Observation[]): Confidence {
  if (observations.length === 0) return "PENDING";
  if (observations.some((item) => item.quality === "STALE")) return "PENDING";
  if (observations.every((item) => item.quality === "FRESH")) return "CONFIRMED";
  return "LEANING";
}
