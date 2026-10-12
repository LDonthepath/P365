import {
  cmeGlobexGoldSessionKey,
  qualityFromDailyUtcCadence,
  qualityFromMacroCadence,
  qualityFromMarketHours,
  freshnessPolicyForFamily,
  type MacroCadenceFrequency,
  type MarketFreshnessCalendar,
} from "./freshness";
import { BTC_ETF_NET_FLOW_SERIES_KEY } from "./observation-semantics";
import { OBSERVATION_PROVIDER_RESOURCES } from "./observation-provenance";
import type { DataQuality, Observation } from "./types";

/**
 * Read-only diagnostic: ingestion quality, read-time freshness, operational
 * maturity and use-case fitness are independent axes. None of these fields
 * rewrite canonical Observation.quality, source timestamps or revisions.
 */
export type ObservationReadFreshnessPolicy =
  | { family: "MARKET_REALTIME"; calendar: MarketFreshnessCalendar }
  | { family: "MARKET_DAILY" }
  | { family: "FRED_MACRO"; frequency: MacroCadenceFrequency; toleranceMs: number };

export type ObservationReadMaturity =
  | "MATURED_ELIGIBLE_UNDER_P365_POLICY"
  | "PROVISIONAL_REPORTED"
  | "UNKNOWN"
  | "NOT_EVALUATED";

export type ObservationReadFitness = "ELIGIBLE" | "INELIGIBLE";

export type ObservationReadQuality = {
  observationId: string;
  sourceId: string;
  seriesKey: string;
  asOf: string;
  /** Stored value at acquisition time. Never overwritten by this function. */
  ingestionQuality: DataQuality;
  /** Recomputed with a qualified cadence/session at the read cutoff. */
  evaluatedFreshness: DataQuality;
  /** Provider-native FINAL is never inferred from P365's maturity policy. */
  maturity: ObservationReadMaturity;
  /** Context of the most recent known market/macro fact, not a trade signal. */
  currentContextFitness: ObservationReadFitness;
  /** Suitability as a factual historical predecessor, even when now stale. */
  historicalReferenceFitness: ObservationReadFitness;
};

function isVisibleAt(observation: Observation, asOf: string): boolean {
  const cutoff = Date.parse(asOf);
  const observed = Date.parse(observation.observedAt);
  const retrieved = Date.parse(observation.retrievedAt);
  return Number.isFinite(cutoff) && Number.isFinite(observed) && Number.isFinite(retrieved)
    && observed <= cutoff && retrieved <= cutoff;
}

function etfMaturity(observation: Observation, seriesKey: string): ObservationReadMaturity {
  if (observation.sourceId !== "sosovalue-etf-flow") return "NOT_EVALUATED";
  if (seriesKey !== BTC_ETF_NET_FLOW_SERIES_KEY || observation.domain !== "MARKET") {
    return "UNKNOWN";
  }
  const meta = observation.metadata;
  // Require canonical and compatibility series identities to agree. Legacy rows
  // may lack Observation.identity, but a supplied identity must not contradict
  // the selected ETF series. No maturity status can repair mixed-series data.
  if (
    observation.subject !== seriesKey
    || meta?.metricId !== seriesKey
    || (meta.seriesId !== undefined && meta.seriesId !== seriesKey)
    || (observation.identity !== undefined && observation.identity.seriesKey !== seriesKey)
  ) return "UNKNOWN";
  // A provisional row must not be canonicalized; if a legacy/bad row exists,
  // fail closed rather than treating it as usable.
  if (meta?.maturityStatus === "PROVISIONAL") return "PROVISIONAL_REPORTED";
  const native = observation.provenance;
  const providerDate = observation.observedAt.slice(0, 10);
  if (meta?.maturityStatus === "MATURED_ELIGIBLE_UNDER_P365_POLICY"
    && meta.maturityPolicy === "SOSOVALUE_ETF_FLOW_MATURITY_V0_1"
    && meta.completionBasis === "P365_PROVIDER_DATE_ADVANCEMENT"
    && meta.providerTradingDate === providerDate
    && meta.providerSymbol === "BTC"
    && meta.countryCode === "US"
    && meta.aggregateField === "total_net_inflow"
    && meta.unit === "USD"
    && meta.frequency === "DAILY"
    && meta.providerResource === OBSERVATION_PROVIDER_RESOURCES.soSoValueEtfSummaryHistory
    && native?.version === "v1"
    && native.providerResource === OBSERVATION_PROVIDER_RESOURCES.soSoValueEtfSummaryHistory
    && native.observationDate === providerDate
    && native.nativeSymbol === "BTC"
    && native.nativeInstrumentId === undefined
    && native.nativeSeriesId === undefined
    && native.vintageDate === undefined) {
    // Operational maturity, NEVER an assertion of publisher-native finality.
    return "MATURED_ELIGIBLE_UNDER_P365_POLICY";
  }
  return "UNKNOWN";
}

/** Pure, deterministic point-in-time projection; policy is supplied by reader. */
export function projectObservationReadQuality(input: {
  observation: Observation;
  seriesKey: string;
  asOf: string;
  policy?: ObservationReadFreshnessPolicy;
}): ObservationReadQuality {
  const { observation, seriesKey, asOf, policy } = input;
  const visible = isVisibleAt(observation, asOf);
  let freshness: DataQuality = "UNKNOWN";
  if (visible && policy?.family === "MARKET_REALTIME") {
    freshness = qualityFromMarketHours({
      observedAt: observation.observedAt,
      evaluatedAt: asOf,
      maxAgeMs: freshnessPolicyForFamily("MARKET_REALTIME").maxAgeMs,
      calendar: policy.calendar,
    });
  } else if (visible && policy?.family === "MARKET_DAILY") {
    freshness = qualityFromDailyUtcCadence({ observedAt: observation.observedAt, evaluatedAt: asOf });
  } else if (visible && policy?.family === "FRED_MACRO") {
    freshness = qualityFromMacroCadence({
      observationDate: observation.observedAt.slice(0, 10),
      frequency: policy.frequency,
      toleranceMs: policy.toleranceMs,
      evaluatedAt: asOf,
    });
  }
  const maturity = etfMaturity(observation, seriesKey);
  const needsEtfMaturity = observation.sourceId === "sosovalue-etf-flow";
  const maturityEligible = !needsEtfMaturity || maturity === "MATURED_ELIGIBLE_UNDER_P365_POLICY";
  const historicalEligible = visible && maturityEligible
    && (observation.quality === "FRESH" || observation.quality === "STALE");
  // Excluding closed time from freshness elapsed time alone would let a
  // Friday Gold quote count as a CURRENT Sunday quote at reopening. Current
  // context additionally requires the same qualified CME trading session;
  // earlier sessions can still be historical references.
  let sameGoldSession = true;
  if (policy?.family === "MARKET_REALTIME" && policy.calendar === "CME_GLOBEX_GOLD") {
    const observedSession = cmeGlobexGoldSessionKey(Date.parse(observation.observedAt));
    const asOfSession = cmeGlobexGoldSessionKey(Date.parse(asOf));
    sameGoldSession = observedSession !== null && observedSession === asOfSession;
  }
  const currentEligible = historicalEligible && observation.quality === "FRESH"
    && freshness === "FRESH" && sameGoldSession;

  return {
    observationId: observation.id,
    sourceId: observation.sourceId,
    seriesKey,
    asOf,
    ingestionQuality: observation.quality,
    evaluatedFreshness: freshness,
    maturity,
    currentContextFitness: currentEligible ? "ELIGIBLE" : "INELIGIBLE",
    historicalReferenceFitness: historicalEligible ? "ELIGIBLE" : "INELIGIBLE",
  };
}
