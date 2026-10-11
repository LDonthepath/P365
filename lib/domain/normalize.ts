import type {
  CalendarCanonicalInput, CanonicalNewsInput, CanonicalMarketInput,
  CanonicalLiquidityInput, CanonicalEtfFlowInput, CanonicalPositioningInput,
  CanonicalMacroInput, CanonicalFomcInput, CanonicalSepInput, ProviderHealthInput,
} from "./normalization-inputs";
import type { DataQuality, Evidence, Event, Observation, ObservationSemantics, ProviderHealth, SourceHealthStatus } from "./types";
import { buildObservationIdentity, observationEvidenceId, observationRevisionId } from "./observation-identity";
import { buildEventIdentity } from "./event-identity";
import { assertCurrentObservationInvariants } from "./observation-provenance";
import { requireObservationSemantics } from "./observation-semantics";
import { qualityFromDailyUtcCadence, qualityFromFreshness, qualityFromMacroCadence, qualityFromMarketHours, freshnessPolicyForFamily } from "./freshness";
import type { MarketFreshnessCalendar } from "./freshness";

export const P365_SOURCES = {
  alphaVantage: { id: "alpha-vantage", name: "Alpha Vantage", type: "NEWS" },
  yahooFinance: { id: "yahoo-finance", name: "Yahoo Finance (Gold, Russell 2000, DXY & Asia FX)", type: "MARKET" },
  coinGeckoMarket: { id: "coingecko-market", name: "CoinGecko Market", type: "MARKET" },
  defiLlamaStablecoins: { id: "defillama-stablecoins", name: "DefiLlama Stablecoins", type: "MARKET" },
  soSoValueEtfFlow: { id: "sosovalue-etf-flow", name: "SoSoValue ETF Flow", type: "MARKET" },
  cftcGoldCot: { id: "cftc-gold-cot", name: "CFT¶»§q«^