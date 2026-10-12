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

const DURABLE_PROJECTION_HISTORY_LIMIT = 8;

/**
 * A bounded, source-qualified dashboard projection can stand in for a fresh
 * predecessor query ONLY if it contains a provably latest eligible predecessor
 * (or is an untruncated, complete result). Retrieval cutoff is current's
 * retrievedAt, not dashboard asOf; historical revisions cannot time travel.
 *
 * The repository contract returns DESC by observedAt/retrievedAt/id. Reject
 * malformed ordering/metadata instead of deriving an unsafe predecessor.
 */
function reusablePredecessorCandidates(
  current: Observation,
  seriesKey: string,
  recentHistory: ReadonlyMap<string, readonly Observation[]> | undefined,
): Observation[] | null {
  const rows = recentHistory?.get(seriesKey);
  if (!rows || rows.length > DURABLE_PROJECTION_HISTORY_LIMIT) return null;
  const currentObservedMs = Date.parse(current.observedAt);
  const currentRetrievedMs = Date.parse(current.retrievedAt);
  if (!Number.isFinite(currentObservedMs) || !Number.isFinite(currentRetrievedMs)
    || current.domain !== "MACRO" || current.sourceId !== "fred"
    || current.metadata?.seriesId !== seriesKey
    || current.metadata?.observationDate !== current.observedAt.slice(0, 10)
    || (current.identity && current.identity.seriesKey !== seriesKey)) return null;
  if (!rows.some((row) => row.id === current.id
    && row.observedAt === current.observedAt && row.retrievedAt === current.retrievedAt)) return null;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.domain !== "MACRO" || row.sourceId !== "fred"
      || row.metadata?.seriesId !== seriesKey
      || row.metadata?.observationDate !== row.observedAt.slice(0, 10)
      || (row.identity && row.identity.seriesKey !== seriesKey)
      || !Number.isFinite(Date.parse(row.observedAt))
      || !Number.isFinite(Date.parse(row.retrievedAt))
      || (index > 0 && compareObservationHistory(rows[index - 1], row) < 0)) return null;
  }

  const candidates = rows.filter((row) =>
    Date.parse(row.observedAt) < currentObservedMs
    && Date.parse(row.retrievedAt) <= currentRetrievedMs);
  // When 8 rows were returned, older rows may have been truncated. A latest
  // compatible predecessor in the sorted known prefix proves sufficiency;
  // otherwise the authoritative 500-candidate query must still run.
  if (rows.length === DURABLE_PROJECTION_HISTORY_LIMIT
    && selectFactualBaseline(current, candidates).baselineObservationId === null) return null;
  return candidates;
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
  recentMacroHistory?: ReadonlyMap<string, readonly Observation[]>,
): Promise<Record<string, FactualBaseline>> {
  const currentBySeries = selectCurrentBySeries(currentObservations);
  const entries = await Promise.all([...currentBySeries.entries()].map(async ([seriesKey, current]) => {
    try {
      const reusable = reusablePredecessorCandidates(current, seriesKey, recentMacroHistory);
      const candidates = reusable ?? await repository.findHistory({
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
