import type { Observation } from "../domain/types";
import type { ObservationHistoryQuery } from "./types";

export const MAX_OBSERVATION_HISTORY_LIMIT = 500;

export function observationHistoryTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} timestamp: ${value}`);
  return parsed;
}

export function validateObservationHistoryQuery(
  query: ObservationHistoryQuery,
): { from?: number; through?: number; retrievedThrough?: number } {
  if (!query || !query.identity || !query.identity.seriesKey.trim()) {
    throw new Error("Observation history identity requires a non-empty seriesKey.");
  }
  if (!["MARKET", "MACRO", "ASSET", "OTHER"].includes(query.identity.domain)) {
    throw new Error("Observation history identity requires a valid domain.");
  }
  if (query.sourceId !== undefined && !query.sourceId.trim()) {
    throw new Error("Observation history sourceId filter must be non-empty when supplied.");
  }
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_OBSERVATION_HISTORY_LIMIT) {
    throw new Error(`Observation history limit must be an integer between 1 and ${MAX_OBSERVATION_HISTORY_LIMIT}.`);
  }
  if (query.order !== "ASC" && query.order !== "DESC") {
    throw new Error("Observation history order must be ASC or DESC.");
  }

  const from = query.observedAtOnOrAfter === undefined
    ? undefined
    : observationHistoryTimestamp(query.observedAtOnOrAfter, "observedAtOnOrAfter");
  const through = query.observedAtOnOrBefore === undefined
    ? undefined
    : observationHistoryTimestamp(query.observedAtOnOrBefore, "observedAtOnOrBefore");
  const retrievedThrough = query.retrievedAtOnOrBefore === undefined
    ? undefined
    : observationHistoryTimestamp(query.retrievedAtOnOrBefore, "retrievedAtOnOrBefore");
  if (from !== undefined && through !== undefined && from > through) {
    throw new Error("Observation history lower time bound must not be after its upper bound.");
  }
  return { from, through, retrievedThrough };
}

export function observationSemanticSeriesKey(observation: Observation): string | null {
  const seriesId = observation.metadata?.seriesId;
  if (typeof seriesId === "string" && seriesId.trim()) return seriesId;
  const metricId = observation.metadata?.metricId;
  if (typeof metricId === "string" && metricId.trim()) return metricId;
  return null;
}

export function compareObservationHistory(a: Observation, b: Observation): number {
  const observed = observationHistoryTimestamp(a.observedAt, "Observation.observedAt")
    - observationHistoryTimestamp(b.observedAt, "Observation.observedAt");
  if (observed !== 0) return observed;
  const retrieved = observationHistoryTimestamp(a.retrievedAt, "Observation.retrievedAt")
    - observationHistoryTimestamp(b.retrievedAt, "Observation.retrievedAt");
  if (retrieved !== 0) return retrieved;
  return a.id.localeCompare(b.id);
}
