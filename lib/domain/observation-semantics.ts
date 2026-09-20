import type { Observation, ObservationSemantics } from "./types";

const V = "v0.1" as const;

const SEMANTICS_BY_KEY: Readonly<Record<string, ObservationSemantics>> = {
  FEDFUNDS: { ontologyVersion: V, marketDomain: "POLICY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "POLICY_RATE" },
  EFFR: { ontologyVersion: V, marketDomain: "LIQUIDITY_FUNDING", informationClass: "PRICING", jurisdiction: "US", instrument: "MONEY_MARKET_RATE", tenor: "OVERNIGHT" },
  WALCL: { ontologyVersion: V, marketDomain: "POLICY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "BALANCE_SHEET" },
  WRESBAL: { ontologyVersion: V, marketDomain: "LIQUIDITY_FUNDING", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "BALANCE_SHEET" },
  M2SL: { ontologyVersion: V, marketDomain: "LIQUIDITY_FUNDING", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  WTREGEN: { ontologyVersion: V, marketDomain: "FISCAL_SOVEREIGN", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "CASH" },
  SOFR: { ontologyVersion: V, marketDomain: "LIQUIDITY_FUNDING", informationClass: "PRICING", jurisdiction: "US", instrument: "MONEY_MARKET_RATE", tenor: "OVERNIGHT" },
  IORB: { ontologyVersion: V, marketDomain: "POLICY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "POLICY_RATE", tenor: "OVERNIGHT" },
  RRPONTSYD: { ontologyVersion: V, marketDomain: "LIQUIDITY_FUNDING", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "CASH" },

  CPIAUCSL: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  CPILFESL: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  PCEPI: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  PCEPILFE: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  UNRATE: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  PAYEMS: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  ICSA: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  CCSA: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  JTSJOL: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  JTSQUR: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  SAHMREALTIME: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "DERIVED_METRIC", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },
  GDPC1: { ontologyVersion: V, marketDomain: "ECONOMY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "ECONOMIC_SERIES" },

  DGS2: { ontologyVersion: V, marketDomain: "RATES", informationClass: "PRICING", jurisdiction: "US", instrument: "SOVEREIGN_BOND", tenor: "2Y" },
  DGS10: { ontologyVersion: V, marketDomain: "RATES", informationClass: "PRICING", jurisdiction: "US", instrument: "SOVEREIGN_BOND", tenor: "10Y" },
  DFII10: { ontologyVersion: V, marketDomain: "RATES", informationClass: "PRICING", jurisdiction: "US", instrument: "SOVEREIGN_BOND", tenor: "10Y", asset: "US_TIPS" },
  T10YIE: { ontologyVersion: V, marketDomain: "RATES", informationClass: "PRICING", jurisdiction: "US", instrument: "SOVEREIGN_BOND", tenor: "10Y", asset: "INFLATION_COMPENSATION" },
  T10Y2Y: { ontologyVersion: V, marketDomain: "RATES", informationClass: "DERIVED_METRIC", jurisdiction: "US", instrument: "SOVEREIGN_BOND", tenor: "10Y-2Y" },

  BAMLC0A0CM: { ontologyVersion: V, marketDomain: "CREDIT", informationClass: "PRICING", jurisdiction: "US", instrument: "CREDIT_INDEX", asset: "US_IG" },
  BAMLH0A0HYM2: { ontologyVersion: V, marketDomain: "CREDIT", informationClass: "PRICING", jurisdiction: "US", instrument: "CREDIT_INDEX", asset: "US_HY" },

  DTWEXBGS: { ontologyVersion: V, marketDomain: "FX", informationClass: "PRICING", jurisdiction: "US", instrument: "FX_INDEX", asset: "USD" },
  VIXCLS: { ontologyVersion: V, marketDomain: "VOLATILITY", informationClass: "PRICING", jurisdiction: "US", instrument: "INDEX", asset: "VIX" },
  SP500: { ontologyVersion: V, marketDomain: "EQUITY", informationClass: "PRICING", jurisdiction: "US", instrument: "INDEX", asset: "SP500" },
  NASDAQCOM: { ontologyVersion: V, marketDomain: "EQUITY", informationClass: "PRICING", jurisdiction: "US", instrument: "INDEX", asset: "NASDAQ_COMPOSITE" },
  DCOILWTICO: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "PRICING", jurisdiction: "US", instrument: "COMMODITY_CONTRACT", asset: "WTI" },

  "gold.futures.usd": { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "PRICING", jurisdiction: "GLOBAL", instrument: "FUTURE", asset: "GOLD" },
  "russell2000.index.usd": { ontologyVersion: V, marketDomain: "EQUITY", informationClass: "PRICING", jurisdiction: "US", instrument: "INDEX", asset: "RUSSELL_2000" },
  "dxy.index.usd": { ontologyVersion: V, marketDomain: "FX", informationClass: "PRICING", jurisdiction: "US", instrument: "FX_INDEX", asset: "USD" },

  "btc.spot.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "PRICING", jurisdiction: "GLOBAL", instrument: "CRYPTO_SPOT", asset: "BTC" },
  "eth.spot.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "PRICING", jurisdiction: "GLOBAL", instrument: "CRYPTO_SPOT", asset: "ETH" },
  "btc.market_cap.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", instrument: "CRYPTO_SPOT", asset: "BTC" },
  "eth.market_cap.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", instrument: "CRYPTO_SPOT", asset: "ETH" },
  "crypto.total_market_cap.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", asset: "TOTAL_CRYPTO" },
  "crypto.total_volume_24h.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", asset: "TOTAL_CRYPTO" },
  "crypto.btc_dominance.pct": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "DERIVED_METRIC", jurisdiction: "GLOBAL", asset: "BTC" },
  "crypto.eth_dominance.pct": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "DERIVED_METRIC", jurisdiction: "GLOBAL", asset: "ETH" },
};

export function observationSemanticsForSeriesKey(seriesKey: string): ObservationSemantics | null {
  const normalized = seriesKey.trim();
  if (!normalized) return null;
  return SEMANTICS_BY_KEY[normalized] ?? null;
}

export function requireObservationSemantics(seriesKey: string): ObservationSemantics {
  const semantics = observationSemanticsForSeriesKey(seriesKey);
  if (!semantics) {
    throw new Error(`No approved observation semantics for series key: ${seriesKey}`);
  }
  return semantics;
}

function machineSeriesKey(observation: Observation): string | null {
  const seriesId = observation.metadata?.seriesId;
  if (typeof seriesId === "string" && seriesId.trim()) return seriesId;
  const metricId = observation.metadata?.metricId;
  if (typeof metricId === "string" && metricId.trim()) return metricId;
  return null;
}

/**
 * Compatibility resolver for current and legacy Market Memory rows.
 *
 * New canonical writes carry Observation.semantics directly. Historical rows
 * remain immutable and can be interpreted from their stable series/metric key
 * without a destructive backfill.
 */
export function resolveObservationSemantics(observation: Observation): ObservationSemantics | null {
  if (observation.semantics) return observation.semantics;
  const key = machineSeriesKey(observation);
  return key ? observationSemanticsForSeriesKey(key) : null;
}

export function approvedObservationSemanticKeys(): string[] {
  return Object.keys(SEMANTICS_BY_KEY);
}
