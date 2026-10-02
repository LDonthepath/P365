import {
  CFTC_GOLD_COT_SERIES_KEYS,
} from "./observation-semantics";
import {
  OBSERVATION_PROVIDER_RESOURCES,
} from "./observation-provenance";
import {
  deriveGoldManagedMoneyNet,
  type GoldManagedMoneyNet,
} from "./gold-positioning-derived";
import type { Observation } from "./types";

export const GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1 =
  "cftc-gold-positioning-historical-fitness-v1" as const;

export type GoldCftcHistoricalFitnessBasis =
  | "CANONICAL_QUALITY"
  | "CFTC_SOURCE_QUALIFICATION";

export type GoldCftcHistoricalLegFitness =
  | {
      status: "ELIGIBLE";
      basis: GoldCftcHistoricalFitnessBasis;
      observation: Observation;
      reportDate: string;
      seriesKey:
        | typeof CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong
        | typeof CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort;
      value: number;
    }
  | {
      status: "INELIGIBLE";
      reason: string;
    };

export type GoldManagedMoneyHistoricalPairFitness =
  | {
      status: "ELIGIBLE";
      policy: typeof GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1;
      reportDate: string;
      long: Extract<GoldCftcHistoricalLegFitness, { status: "ELIGIBLE" }>;
      short: Extract<GoldCftcHistoricalLegFitness, { status: "ELIGIBLE" }>;
      net: GoldManagedMoneyNet;
      basis:
        | "CANONICAL_QUALITY"
        | "CFTC_SOURCE_QUALIFICATION"
        | "MIXED";
    }
  | {
      status: "INELIGIBLE";
      policy: typeof GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1;
      reason: string;
    };

const EXPECTED_PROVIDER_FIELD = {
  [CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong]:
    "m_money_positions_long_all",
  [CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort]:
    "m_money_positions_short_all",
} as const;

const EXPECTED_SIDE = {
  [CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong]: "LONG",
  [CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort]: "SHORT",
} as const;

type ManagedMoneyDirectionalSeriesKey = keyof typeof EXPECTED_PROVIDER_FIELD;

function metadataString(
  observation: Observation,
  key: string,
): string | undefined {
  const value = observation.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function canonicalSeriesKey(
  observation: Observation,
): ManagedMoneyDirectionalSeriesKey | null {
  const key = observation.identity?.seriesKey
    ?? metadataString(observation, "metricId");
  return key === CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong
    || key === CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort
    ? key
    : null;
}

function validTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceQualified(
  observation: Observation,
  asOfMs: number,
): { ok: true; reportDate: string; seriesKey: ManagedMoneyDirectionalSeriesKey; value: number }
  | { ok: false; reason: string } {
  const seriesKey = canonicalSeriesKey(observation);
  if (!seriesKey) {
    return {
      ok: false,
      reason:
        "CFTC historical fitness accepts only Managed Money long/short canonical series.",
    };
  }

  const observedAtMs = validTimestamp(observation.observedAt);
  const retrievedAtMs = validTimestamp(observation.retrievedAt);
  if (observedAtMs === null || retrievedAtMs === null) {
    return {
      ok: false,
      reason:
        "CFTC historical fitness requires valid observedAt and retrievedAt timestamps.",
    };
  }
  if (retrievedAtMs > asOfMs) {
    return {
      ok: false,
      reason:
        "CFTC Observation was not knowable by the requested asOf cutoff.",
    };
  }
  if (retrievedAtMs < observedAtMs) {
    return {
      ok: false,
      reason:
        "CFTC retrieval availability cannot precede its report/effective date.",
    };
  }

  const reportDate = observation.observedAt.slice(0, 10);
  if (observation.observedAt !== reportDate + "T00:00:00.000Z") {
    return {
      ok: false,
      reason:
        "CFTC report/effective time must use the canonical date anchor.",
    };
  }

  const value = Number(observation.value);
  if (!Number.isSafeInteger(value) || value < 0) {
    return {
      ok: false,
      reason:
        "CFTC directional contract count must be a non-negative safe integer.",
    };
  }

  const semantics = observation.semantics;
  const provenance = observation.provenance;
  const identity = observation.identity;
  const providerField = EXPECTED_PROVIDER_FIELD[seriesKey];

  const invariant =
    observation.domain === "MARKET"
    && observation.sourceId === "cftc-gold-cot"
    && identity?.version === "v1"
    && identity.seriesKey === seriesKey
    && metadataString(observation, "metricId") === seriesKey
    && provenance?.version === "v1"
    && provenance.providerResource
      === OBSERVATION_PROVIDER_RESOURCES.cftcDisaggregatedFuturesOnly
    && provenance.nativeInstrumentId === "088691"
    && provenance.nativeSeriesId === providerField
    && provenance.observationDate === reportDate
    && provenance.nativeSymbol === undefined
    && provenance.vintageDate === undefined
    && semantics?.ontologyVersion === "v0.1"
    && semantics.marketDomain === "COMMODITY"
    && semantics.informationClass === "POSITIONING"
    && semantics.jurisdiction === "US"
    && semantics.instrument === "FUTURE"
    && semantics.asset === "GOLD"
    && semantics.participant === "MANAGED_MONEY"
    && metadataString(observation, "providerResource")
      === OBSERVATION_PROVIDER_RESOURCES.cftcDisaggregatedFuturesOnly
    && metadataString(observation, "datasetId") === "72hh-3qpy"
    && metadataString(observation, "contractMarketCode") === "088691"
    && metadataString(observation, "marketName")
      === "GOLD - COMMODITY EXCHANGE INC."
    && metadataString(observation, "reportFamily")
      === "DISAGGREGATED_FUTURES_ONLY"
    && metadataString(observation, "reportDate") === reportDate
    && metadataString(observation, "providerField") === providerField
    && metadataString(observation, "participantCategory") === "MANAGED_MONEY"
    && metadataString(observation, "positionSide") === EXPECTED_SIDE[seriesKey]
    && metadataString(observation, "unit") === "CONTRACTS"
    && metadataString(observation, "frequency") === "WEEKLY"
    && metadataString(observation, "observationEffectiveAt")
      === observation.observedAt;

  if (!invariant) {
    return {
      ok: false,
      reason:
        "CFTC Observation failed exact source/provenance/semantic historical-fitness qualification.",
    };
  }

  return { ok: true, reportDate, seriesKey, value };
}

/**
 * GOLD-POS-001F source-specific historical-fitness qualification.
 *
 * Generic HIST-001B behavior is intentionally unchanged: UNKNOWN remains
 * ineligible there. This qualifier exists only for the derived Gold CFTC
 * positioning path, where canonical quality is UNKNOWN because release-calendar
 * freshness has not been assigned, while source identity/schema/provenance can
 * still be validated exactly.
 *
 * The function never rewrites Observation.quality.
 */
export function qualifyGoldCftcHistoricalLeg(input: {
  observation: Observation;
  asOf: string;
}): GoldCftcHistoricalLegFitness {
  const asOfMs = validTimestamp(input.asOf);
  if (asOfMs === null) {
    return {
      status: "INELIGIBLE",
      reason: "CFTC historical fitness requires a valid asOf timestamp.",
    };
  }

  if (input.observation.quality === "PARTIAL") {
    return {
      status: "INELIGIBLE",
      reason:
        "PARTIAL CFTC Observation is never eligible for historical positioning context.",
    };
  }

  const qualified = sourceQualified(input.observation, asOfMs);
  if (!qualified.ok) {
    return { status: "INELIGIBLE", reason: qualified.reason };
  }

  return {
    status: "ELIGIBLE",
    basis: input.observation.quality === "UNKNOWN"
      ? "CFTC_SOURCE_QUALIFICATION"
      : "CANONICAL_QUALITY",
    observation: input.observation,
    reportDate: qualified.reportDate,
    seriesKey: qualified.seriesKey,
    value: qualified.value,
  };
}

/**
 * Qualifies one weekly Managed Money long/short pair for later historical
 * distribution construction. It may derive the already-authorized net metric,
 * but it does not calculate percentile, z-score, crowding, direction, or signal.
 */
export function qualifyGoldManagedMoneyHistoricalPair(input: {
  long: Observation;
  short: Observation;
  asOf: string;
}): GoldManagedMoneyHistoricalPairFitness {
  const long = qualifyGoldCftcHistoricalLeg({
    observation: input.long,
    asOf: input.asOf,
  });
  if (long.status !== "ELIGIBLE") {
    return {
      status: "INELIGIBLE",
      policy: GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1,
      reason: "Managed Money long is ineligible: " + long.reason,
    };
  }
  if (long.seriesKey !== CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong) {
    return {
      status: "INELIGIBLE",
      policy: GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1,
      reason: "Managed Money long input uses the wrong canonical series.",
    };
  }

  const short = qualifyGoldCftcHistoricalLeg({
    observation: input.short,
    asOf: input.asOf,
  });
  if (short.status !== "ELIGIBLE") {
    return {
      status: "INELIGIBLE",
      policy: GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1,
      reason: "Managed Money short is ineligible: " + short.reason,
    };
  }
  if (short.seriesKey !== CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort) {
    return {
      status: "INELIGIBLE",
      policy: GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1,
      reason: "Managed Money short input uses the wrong canonical series.",
    };
  }

  if (long.reportDate !== short.reportDate) {
    return {
      status: "INELIGIBLE",
      policy: GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1,
      reason:
        "Managed Money long/short historical inputs must share one report date.",
    };
  }

  const net = deriveGoldManagedMoneyNet({
    long: {
      observationId: long.observation.id,
      seriesKey: long.seriesKey,
      value: long.value,
      observedAt: long.observation.observedAt,
      retrievedAt: long.observation.retrievedAt,
    },
    short: {
      observationId: short.observation.id,
      seriesKey: short.seriesKey,
      value: short.value,
      observedAt: short.observation.observedAt,
      retrievedAt: short.observation.retrievedAt,
    },
  });

  const basis = long.basis === short.basis
    ? long.basis
    : "MIXED";

  return {
    status: "ELIGIBLE",
    policy: GOLD_CFTC_HISTORICAL_FITNESS_POLICY_V1,
    reportDate: long.reportDate,
    long,
    short,
    net,
    basis,
  };
}
