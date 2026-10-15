import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import type { BinanceSpotKline } from "../data/binance-spot-flow";
import type { BinanceOrderBookSnapshot } from "../data/binance-order-book";
import type { HyperliquidPerpOrderBookSnapshot } from "../data/hyperliquid-perp-order-book";
import type { SoSoValueBtcEtfFlowObservationInput } from "../data/sosovalue-etf-flow";
import type { CftcGoldCotObservationInput } from "../data/cftc-gold-cot";
import type { ProviderResult } from "../data/types";
import { btcEtfFlowToCanonicalRecords, cftcGoldCotToCanonicalRecords, cryptoMarketToObservations, P365_SOURCES, stablecoinLiquidityToCanonicalRecords } from "../normalization/provider-canonical-market";
import { buildBinanceBtcSpotFlowWindow } from "./btc-spot-flow";
import { btcSpotFlowWindowsToEvidence } from "./btc-spot-flow-history";
import { buildBinanceBtcOrderBookLiquiditySnapshot } from "./btc-order-book-liquidity";
import { buildHyperliquidBtcPerpLiquiditySnapshot } from "./btc-perp-order-book-liquidity";
import {
  binanceBtcSpotOrderBookSnapshotToEvidence,
  hyperliquidBtcPerpOrderBookSnapshotToEvidence,
} from "./btc-order-book-history";
import type { CanonicalHistoricalBatch } from "./historical-ingestion-macro-normalization";
import { canonicalizeRetainedMacroResult, isRetainedMacroHistoricalProvider } from "./historical-ingestion-macro-normalization";


import type { HistoricalIngestionMode, HistoricalIngestionProvider } from "./historical-ingestion-contract";

export type { CanonicalHistoricalBatch } from "./historical-ingestion-macro-normalization";

export function canonicalizeHistoricalResult(
  result: ProviderResult<unknown>,
  provider: HistoricalIngestionProvider,
  mode: HistoricalIngestionMode,
): CanonicalHistoricalBatch {
  if (isRetainedMacroHistoricalProvider(provider)) {
    return canonicalizeRetainedMacroResult(result, provider);
  }
  if (provider === "defillama") {
    const rows = result.data as DefiLlamaStablecoinObservationInput[];
    const selected = mode === "FORWARD" && rows.length > 0
      ? [rows.reduce((latest, row) => row.observedAt > latest.observedAt ? row : latest)]
      : rows;
    return stablecoinLiquidityToCanonicalRecords(
      selected,
    );
  }
  if (provider === "sosovalue") {
    return btcEtfFlowToCanonicalRecords(result.data as SoSoValueBtcEtfFlowObservationInput[]);
  }
  if (provider === "cftc") {
    return cftcGoldCotToCanonicalRecords(result.data as CftcGoldCotObservationInput[]);
  }
  if (provider === "binance-spot") {
    const windows = (result.data as BinanceSpotKline[]).map(buildBinanceBtcSpotFlowWindow);
    return {
      observations: [],
      evidence: btcSpotFlowWindowsToEvidence({ windows, retrievedAt: result.retrievedAt }),
    };
  }
  if (provider === "binance-book") {
    const snapshots = (result.data as BinanceOrderBookSnapshot[]).map((snapshot) =>
      buildBinanceBtcOrderBookLiquiditySnapshot({ snapshot, retrievedAt: result.retrievedAt }));
    return {
      observations: [],
      evidence: snapshots.map(binanceBtcSpotOrderBookSnapshotToEvidence),
    };
  }
  if (provider === "hyperliquid-book") {
    const snapshots = (result.data as HyperliquidPerpOrderBookSnapshot[]).map((snapshot) =>
      buildHyperliquidBtcPerpLiquiditySnapshot({ snapshot, retrievedAt: result.retrievedAt }));
    return {
      observations: [],
      evidence: snapshots.map(hyperliquidBtcPerpOrderBookSnapshotToEvidence),
    };
  }
  if (provider === "coingecko" || provider === "coingecko-context") {
    // Internal persistence lanes share the existing provider and canonical identity.
    // Filter before normalization so excluded series cannot write Observation or Evidence.
    const metrics = provider === "coingecko"
      ? ["btc.spot.usd", "eth.spot.usd"]
      : [
        "btc.market_cap.usd", "eth.market_cap.usd",
        "crypto.total_market_cap.usd", "crypto.total_volume_24h.usd",
        "crypto.btc_dominance.pct", "crypto.eth_dominance.pct",
      ];
    const selected = (result.data as CryptoMarketObservationInput[])
      .filter((item) => metrics.includes(item.metricId));
    return cryptoMarketToObservations(selected, P365_SOURCES.coinGeckoMarket.id);
  }
  return cryptoMarketToObservations(
    result.data as CryptoMarketObservationInput[],
    P365_SOURCES.yahooFinance.id,
  );
}
