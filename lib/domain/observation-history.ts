import type { Observation, ObservationDomain } from "./types";

/**
 * Provider-independent logical identity for an Observation series.
 * `seriesKey` reuses the machine semantic key retained by normalization:
 * metadata.seriesId for current FRED observations or metadata.metricId for
 * current market observations. Providers that represent the same logical
 * series must normalize to the same key. Descriptive subjects, source IDs,
 * and per-measurement canonical IDs are not semantic-series identity.
 */
export type ObservationHistoryIdentity = {
  domain: ObservationDomain;
  seriesKey: string;
};

export function observationHistoryTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} timestamp: ${value}`);
  return parsed;
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
