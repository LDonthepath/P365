import {
  CFTC_GOLD_COT_SERIES_KEYS,
  requireObservationSemantics,
} from "./observation-semantics";
import { OBSERVATION_PROVIDER_RESOURCES } from "./observation-provenance";
import type { Observation } from "./types";

export const HISTORICAL_FITNESS_POLICY_CANONICAL_V1 =
  "canonical-quality-historical-fitness-v1" as const;
export const HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1 =
  "cftc-gold-cot-source-qualified-historical-fitness-v1" as const;

export type HistoricalObservationFitnessPolicy =
  | typeof HISTORICAL_FITNESS_POLICY_CANONICAL_V1
  | typeof HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1;

const CFTC_SERIES_KEYS = new Set<string>(
  Object.values(CFTC_GOLD_COT_SERIES_KEYS),
);

function metadataString(
  observation: Observation,
  key: string,
): string | undefined {
  const value = observation.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function exactSemanticsMatch(observation: Observation): boolean {
  const seriesKey = observation.identity?.seriesKey;
  if (!seriesKey || !CFTC_SERIES_KEYS.has(seriesKey)) return false;

  const expected = requireObservationSemantics(seriesKey);
  const actual = observation.semantics;
  if (!actual) return false;

  return actual.ontologyVersion === expected.ontologyVersion
    && actual.marketDomain === expected.marketDomain
    && actual.informationClass === expected.informationClass
    && actual.jurisdiction === expected.jurisdiction
    && actual.instrument === expected.instrument
    && actual.asset === expected.asset
    && actual.participant === expected.participant
    && actual.tenor === expected.tenor;
}

export function isSourceQualifiedCftcGoldCotObservation(
  observation: Observation,
): boolean {
  if (
    observation.domain !== "MARKET"
    || observation.sourceId !== "cftc-gold-cot"
    || observation.quality !== "UNKNOWN"
  ) {
    return false;
  }

  const seriesKey = observation.identity?.seriesKey;
  const provenance = observation.provenance;
  if (
    !seriesKey
    || !CFTC_SERIES_KEYS.has(seriesKey)
    || !provenance
    || !exactSemanticsMatch(observation)
  ) {
    return false;
  }

  const reportDate = observation.observedAt.slice(0, 10);
  return provenance.version === "v1"
    && provenance.providerResource
      === OBSERVATION_PROVIDER_RESOURCES.cftcDisaggregatedFuturesOnly
    && provenance.nativeInstrumentId === "088691"
    && provenance.nativeSeriesId === metadataString(observation, "providerField")
    && provenance.nativeSymbol === undefined
    && provenance.vintageDate === undefined
    && provenance.observationDate === reportDate
    && metadataString(observation, "datasetId") === "72hh-3qpy"
    && metadataString(observation, "contractMarketCode") === "088691"
    && metadataString(observation, "reportFamily")
      === "DISAGGREGATED_FUTURES_ONLY"
    && metadataString(observation, "reportDate") === reportDate
    && metadataString(observation, "unit") === "CONTRACTS"
    && metadataString(observation, "frequency") === "WEEKLY"
    && metadataString(observation, "providerResource")
      === OBSERVATION_PROVIDER_RESOURCES.cftcDisaggregatedFuturesOnly;
}

/**
 * Historical factual fitness is distinct from current freshness.
 *
 * Default behavior remains FND-002Q/HIST-001A:
 * - FRESH / STALE are eligible;
 * - UNKNOWN / PARTIAL are not.
 *
 * The CFTC policy is a narrow compatibility bridge for immutable production
 * rows written before release-calendar-aware quality existed. It does not
 * rewrite Observation.quality. UNKNOWN is accepted only when the canonical
 * CFTC source, dataset, contract, report-family, provenance, and semantics
 * all match exactly. PARTIAL remains ineligible under every policy.
 */
export function historicalObservationFitnessEligible(
  observation: Observation,
  policy: HistoricalObservationFitnessPolicy =
    HISTORICAL_FITNESS_POLICY_CANONICAL_V1,
): boolean {
  if (observation.quality === "FRESH" || observation.quality === "STALE") {
    return true;
  }
  if (observation.quality === "PARTIAL") return false;

  return policy === HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1
    && isSourceQualifiedCftcGoldCotObservation(observation);
}
