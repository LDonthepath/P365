import type { ObservationSemantics } from "./types";

export const GOLD_MANAGED_MONEY_NET_SERIES_KEY =
  "gold.cftc.managed_money.net.contracts" as const;

export const GOLD_MANAGED_MONEY_NET_METHODOLOGY_V1 = {
  methodologyId: "cftc-gold-managed-money-net-long-minus-short-v1",
  methodologyVersion: "v1",
  formula: "LONG_MINUS_SHORT",
} as const;

export const GOLD_MANAGED_MONEY_NET_SEMANTICS_V1: ObservationSemantics = {
  ontologyVersion: "v0.1",
  marketDomain: "COMMODITY",
  informationClass: "DERIVED_METRIC",
  jurisdiction: "US",
  instrument: "FUTURE",
  asset: "GOLD",
  participant: "MANAGED_MONEY",
};

export type GoldManagedMoneyDirectionalLeg = {
  observationId: string;
  seriesKey: string;
  value: number;
  observedAt: string;
  retrievedAt: string;
};

export type GoldManagedMoneyNet = {
  seriesKey: typeof GOLD_MANAGED_MONEY_NET_SERIES_KEY;
  value: number;
  unit: "CONTRACTS";
  observedAt: string;
  knownAt: string;
  semantics: ObservationSemantics;
  methodologyId: typeof GOLD_MANAGED_MONEY_NET_METHODOLOGY_V1.methodologyId;
  methodologyVersion:
    typeof GOLD_MANAGED_MONEY_NET_METHODOLOGY_V1.methodologyVersion;
  formula: typeof GOLD_MANAGED_MONEY_NET_METHODOLOGY_V1.formula;
  inputObservationIds: [string, string];
  inputSeriesKeys: [string, string];
  spreadingIncluded: false;
};

/**
 * GOLD-POS-001D deterministic derived metric.
 *
 * Managed Money net = source-reported Managed Money long contracts
 *                    - source-reported Managed Money short contracts.
 *
 * Spreading is intentionally excluded because CFTC defines it separately from
 * directional long/short exposure. This function does not infer bullishness,
 * bearishness, crowding, percentile, z-score, causality, or future returns.
 */
export function deriveGoldManagedMoneyNet(input: {
  long: GoldManagedMoneyDirectionalLeg;
  short: GoldManagedMoneyDirectionalLeg;
}): GoldManagedMoneyNet {
  const long = input.long;
  const short = input.short;

  if (!long.observationId.trim() || !short.observationId.trim()) {
    throw new Error(
      "GOLD-POS-001D requires explicit canonical Observation IDs for long and short.",
    );
  }
  if (!long.seriesKey.trim() || !short.seriesKey.trim()) {
    throw new Error(
      "GOLD-POS-001D requires explicit canonical series keys for long and short.",
    );
  }
  if (!Number.isFinite(long.value) || !Number.isFinite(short.value)) {
    throw new Error(
      "GOLD-POS-001D requires finite long and short contract counts.",
    );
  }
  if (long.observedAt !== short.observedAt) {
    throw new Error(
      "GOLD-POS-001D long and short inputs must share one CFTC report date.",
    );
  }

  const longRetrievedMs = Date.parse(long.retrievedAt);
  const shortRetrievedMs = Date.parse(short.retrievedAt);
  if (!Number.isFinite(longRetrievedMs) || !Number.isFinite(shortRetrievedMs)) {
    throw new Error(
      "GOLD-POS-001D requires valid retrieval timestamps for both inputs.",
    );
  }

  return {
    seriesKey: GOLD_MANAGED_MONEY_NET_SERIES_KEY,
    value: long.value - short.value,
    unit: "CONTRACTS",
    observedAt: long.observedAt,
    knownAt: new Date(Math.max(longRetrievedMs, shortRetrievedMs)).toISOString(),
    semantics: GOLD_MANAGED_MONEY_NET_SEMANTICS_V1,
    methodologyId: GOLD_MANAGED_MONEY_NET_METHODOLOGY_V1.methodologyId,
    methodologyVersion: GOLD_MANAGED_MONEY_NET_METHODOLOGY_V1.methodologyVersion,
    formula: GOLD_MANAGED_MONEY_NET_METHODOLOGY_V1.formula,
    inputObservationIds: [long.observationId, short.observationId],
    inputSeriesKeys: [long.seriesKey, short.seriesKey],
    spreadingIncluded: false,
  };
}
