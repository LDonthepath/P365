import type { Confidence, Observation, State } from "./types";
import { assertStateHasEvidence } from "./contracts";

export function buildState(input: {
  id: string;
  domain: string;
  value: string;
  observations: Observation[];
  confidence?: Confidence;
  evaluatedAt?: string;
}): State {
  const derivedConfidence = confidenceFromObservations(input.observations);
  if (input.confidence === "CONFIRMED" && derivedConfidence !== "CONFIRMED") {
    throw new Error(`State ${input.id} cannot be CONFIRMED with stale, unknown, or incomplete-quality observations`);
  }

  const state = {
    id: input.id,
    domain: input.domain,
    value: input.value,
    confidence: input.confidence ?? derivedConfidence,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    evidenceIds: input.observations.map((item) => item.evidenceId),
  } satisfies State;

  return assertStateHasEvidence(state);
}

export function confidenceFromObservations(observations: Observation[]): Confidence {
  if (observations.length === 0) return "PENDING";
  if (observations.some((item) => item.quality === "STALE" || item.quality === "UNKNOWN")) return "PENDING";
  if (observations.every((item) => item.quality === "FRESH")) return "CONFIRMED";
  return "LEANING";
}
