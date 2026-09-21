import {
  FACTUAL_BASELINE_QUALITY_POLICY,
  selectFactualBaseline,
  type FactualBaseline,
} from "../domain/baseline";
import type { Observation } from "../domain/types";
import { compareObservationHistory, observationSemanticSeriesKey } from "../repositories/observation-history";
import type { HistoricalObservationRepository } from "../repositories/types";

const BASELINE_HISTORY_LIMIT = 500;

function repositoryFailureBaseline(current: Observation): FactualBaseline {
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
    currentObservationQuality: current.quality,
    baselineObservationQuality: null,
    qualityPolicy: FACTUAL_BASELINE_QUALITY_POLICY,
    reason: "Historical Observation repository read failed; factual baseline is unavailable.",
  };
}

function strictPredecessorBound(observedAt: string): string {
  const currentTime = Date.parse(observedAt);
  if (!Number.isFinite(currentTime)) {
    throw new Error("Current observation has an invalid observedAt timestamp.");
  }
  return new Date(currentTime - 1).toISOString();
}

function selectCurrentBySeries(observations: Observation[]): Map<string, Observation> {
  const grouped = new Map<string, Observation[]>();
  for (const observation of observations) {
    if (observation.domain !== "MACRO") continue;
    const seriesKey = observationSemanticSeriesKey(observation);
    if (!seriesKey) continue;
    const series = grouped.get(seriesKey) ?? [];
    series.push(observation);
    grouped.set(seriesKey, series);
  }

  return new Map(
    [...grouped.entries()].map(([seriesKey, series]) => [
      seriesKey,
      [...series].sort((a, b) => compareObservationHistory(b, a))[0],
    ]),
  );
}

/**
 * Builds factual macro baselines from durable history. Current observations
 * come from normalization; predecessor candidates come only from the
 * HistoricalObservationRepository and are constrained to what was available
 * when the current observation was retrieved.
 */
export async function buildRepositoryBackedMacroFactualBaselines(
  currentObservations: Observation[],
  repository: HistoricalObservationRepository,
): Promise<Record<string, FactualBaseline>> {
  const currentBySeries = selectCurrentBySeries(currentObservations);
  const entries = await Promise.all([...currentBySeries.entries()].map(async ([seriesKey, current]) => {
    try {
      const candidates = await repository.findHistory({
        identity: { domain: current.domain, seriesKey },
        sourceId: current.sourceId,
        observedAtOnOrBefore: strictPredecessorBound(current.observedAt),
        retrievedAtOnOrBefore: current.retrievedAt,
        order: "DESC",
        limit: BASELINE_HISTORY_LIMIT,
      });
      return [seriesKey, selectFactualBaseline(current, candidates)] as const;
    } catch {
      return [seriesKey, repositoryFailureBaseline(current)] as const;
    }
  }));

  return Object.fromEntries(entries);
}
