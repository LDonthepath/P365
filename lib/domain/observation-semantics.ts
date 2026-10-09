import type { Observation, ObservationSemantics } from "./types";

const V = "v0.1" as const;

export const USD_STABLECOIN_MARKET_CAP_SERIES_KEY = "crypto.usd_stablecoin_market_cap.usd" as const;
export const BTC_ETF_NET_FLOW_SERIES_KEY = "crypto.us_spot_btc_etf_net_flow.usd" as const;
export const CFTC_GOLD_COT_SERIES_KEYS = {
  openInterest: "gold.cftc.comex.open_interest.contracts",
  producerMerchantLong: "gold.cftc.producer_merchant.long.contracts",
  producerMerchantShort: "gold.cftc.producer_merchant.short.contracts",
  swapDealerLong: "gold.cftc.swap_dealer.long.contracts",
  swapDealerShort: "gold.cftc.swap_dealer.short.contracts",
  swapDealerSpreading: "gold.cftc.swap_dealer.spreading.contracts",
  managedMoneyLong: "gold.cftc.managed_money.long.contracts",
  managedMoneyShort: "gold.cftc.managed_money.short.contracts",
  managedMoneySpreading: "gold.cftc.managed_money.spreading.contracts",
  otherReportablesLong: "gold.cftc.other_reportables.long.contracts",
  otherReportablesShort: "gold.cftc.other_reportables.short.contracts",
  otherReportablesSpreading: "gold.cftc.other_reportables.spreading.contracts",
  nonreportableLong: "gold.cftc.nonreportable.long.contracts",
  nonreportableShort: "gold.cftc.nonreportable.short.contracts",
} as const;

const SEMANTICS_BY_KEY: Readonly<Record<string, ObservationSemantics>> = {
  FEDFUNDS: { ontologyVersion: V, marketDomain: "POLICY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "POLICY_RATE" },
  EFFR: { ontologyVersion: V, marketDomain: "LIQUIDITY_FUNDING", informationClass: "PRICING", jurisdiction: "US", instrument: "MONEY_MARKET_RATE", tenor: "OVERNIGHT" },
  WALCL: { ontologyVersion: V, marketDomain: "POLICY", informationClass: "OBSERVATION", jurisdiction: "US", instrument: "BALANCE_SHEET" },
  ECBASSETSW: { ontologyVersion: V, marketDomain: "POLICY", informationClass: "OBSERVATION", jurisdiction: "EURO_AREA", instrument: "BALANCE_SHEET" },
  JPNASSETS: { ontologyVersion: V, marketDomain: "POLICY", informationClass: "OBSERVATION", jurisdiction: "JAPAN", instrument: "BALANCE_SHEET" },
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

  NFCI: { ontologyVersion: V, marketDomain: "LIQUIDITY_FUNDING", informationClass: "DERIVED_METRIC", jurisdiction: "US", instrument: "INDEX", asset: "FINANCIAL_CONDITIONS" },
  ANFCI: { ontologyVersion: V, marketDomain: "LIQUIDITY_FUNDING", informationClass: "DERIVED_METRIC", jurisdiction: "US", instrument: "INDEX", asset: "ADJUSTED_FINANCIAL_CONDITIONS" },

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
  "fx.usdjpy.jpy_per_usd": { ontologyVersion: V, marketDomain: "FX", informationClass: "PRICING", jurisdiction: "JAPAN", instrument: "FX_PAIR", asset: "USDJPY" },
  "fx.usdcnh.cnh_per_usd": { ontologyVersion: V, marketDomain: "FX", informationClass: "PRICING", jurisdiction: "CHINA", instrument: "FX_PAIR", asset: "USDCNH" },

  "btc.spot.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "PRICING", jurisdiction: "GLOBAL", instrument: "CRYPTO_SPOT", asset: "BTC" },
  "eth.spot.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "PRICING", jurisdiction: "GLOBAL", instrument: "CRYPTO_SPOT", asset: "ETH" },
  "btc.market_cap.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", instrument: "CRYPTO_SPOT", asset: "BTC" },
  "eth.market_cap.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", instrument: "CRYPTO_SPOT", asset: "ETH" },
  "crypto.total_market_cap.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", asset: "TOTAL_CRYPTO" },
  "crypto.total_volume_24h.usd": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", asset: "TOTAL_CRYPTO" },
  [USD_STABLECOIN_MARKET_CAP_SERIES_KEY]: { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "OBSERVATION", jurisdiction: "GLOBAL", asset: "USD_STABLECOINS" },
  [BTC_ETF_NET_FLOW_SERIES_KEY]: { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "FLOW", jurisdiction: "US", instrument: "ETF", asset: "BTC" },
  [CFTC_GOLD_COT_SERIES_KEYS.openInterest]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD" },
  [CFTC_GOLD_COT_SERIES_KEYS.producerMerchantLong]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "PRODUCER_MERCHANT_PROCESSOR_USER" },
  [CFTC_GOLD_COT_SERIES_KEYS.producerMerchantShort]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "PRODUCER_MERCHANT_PROCESSOR_USER" },
  [CFTC_GOLD_COT_SERIES_KEYS.swapDealerLong]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "SWAP_DEALER" },
  [CFTC_GOLD_COT_SERIES_KEYS.swapDealerShort]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "SWAP_DEALER" },
  [CFTC_GOLD_COT_SERIES_KEYS.swapDealerSpreading]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "SWAP_DEALER" },
  [CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "MANAGED_MONEY" },
  [CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "MANAGED_MONEY" },
  [CFTC_GOLD_COT_SERIES_KEYS.managedMoneySpreading]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "MANAGED_MONEY" },
  [CFTC_GOLD_COT_SERIES_KEYS.otherReportablesLong]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "OTHER_REPORTABLES" },
  [CFTC_GOLD_COT_SERIES_KEYS.otherReportablesShort]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "OTHER_REPORTABLES" },
  [CFTC_GOLD_COT_SERIES_KEYS.otherReportablesSpreading]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "OTHER_REPORTABLES" },
  [CFTC_GOLD_COT_SERIES_KEYS.nonreportableLong]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "NONREPORTABLE" },
  [CFTC_GOLD_COT_SERIES_KEYS.nonreportableShort]: { ontologyVersion: V, marketDomain: "COMMODITY", informationClass: "POSITIONING", jurisdiction: "US", instrument: "FUTURE", asset: "GOLD", participant: "NONREPORTABLE" },
  "crypto.btc_dominance.pct": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "DERIVED_METRIC", jurisdiction: "GLOBAL", asset: "BTC" },
  "crypto.eth_dominance.pct": { ontologyVersion: V, marketDomain: "CRYPTO", informationClass: "DERIVED_METRIC", jurisdiction: "GLOBAL", asset: "ETH" },
};

function federalReserveSepSemantics(seriesKey: string): ObservationSemantics | null {
  const median = seriesKey.match(/^policy\.us\.sep\.ffr\.(year_end_(20\d{2})|longer_run)\.median_pct$/);
  const participant = seriesKey.match(
    /^policy\.us\.sep\.ffr\.(year_end_(20\d{2})|longer_run)\.midpoint_\d+_millipct\.participant_count$/,
  );
  const match = median ?? participant;
  if (!match) return null;
  const horizon = match[1] === "longer_run" ? "LONGER_RUN" : `YEAR_END_${match[2]}`;
  return {
    ontologyVersion: V,
    marketDomain: "POLICY",
    informationClass: "EXPECTATION",
    jurisdiction: "US",
    instrument: "POLICY_RATE",
    tenor: horizon,
  };
}

export function observationSemanticsForSeriesKey(seriesKey: string): ObservationSemantics | null {
  const normalized = seriesKey.trim();
  if (!normalized) return null;
  return SEMANTICS_BY_KEY[normalized] ?? federalReserveSepSemantics(normalized);
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
