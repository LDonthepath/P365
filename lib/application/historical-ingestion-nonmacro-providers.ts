import type { HistoricalIngestionAcquisition, HistoricalIngestionOptions } from "./historical-ingestion-contract";

/**
 * Non-MVP acquisition adapters. This boundary retains their exact runtime
 * behavior until a later owner-approved removal checkpoint.
 */
type NonMacroAcquisition = Omit<HistoricalIngestionAcquisition, "fred" | "federal-reserve-sep" | "gdelt">;

export async function createNonMacroAcquisition(
  options: HistoricalIngestionOptions,
): Promise<NonMacroAcquisition> {
  const [binanceSpot, binanceBook, hyperliquidBook, crypto, cftc, defillama, sosovalue, yahoo] = await Promise.all([
    import("../data/binance-spot-flow"),
    import("../data/binance-order-book"),
    import("../data/hyperliquid-perp-order-book"),
    import("../data/crypto-market"),
    import("../data/cftc-gold-cot"),
    import("../data/defillama-stablecoins"),
    import("../data/sosovalue-etf-flow"),
    import("../data/yahoo-finance-markets"),
  ]);

  return {
    "binance-spot": () => binanceSpot.fetchBinanceBtcSpotKlines({ limit: 3, acquisitionMode: "FRESH" }),
    "binance-book": () => binanceBook.fetchBinanceBtcOrderBook({ limit: 500, acquisitionMode: "FRESH" }),
    "hyperliquid-book": () => hyperliquidBook.fetchHyperliquidBtcPerpOrderBook({ acquisitionMode: "FRESH" }),
    coingecko: () => crypto.fetchCryptoMarketObservations(["BTC", "ETH"], "FRESH"),
    "coingecko-context": () => crypto.fetchCryptoMarketObservations(["BTC", "ETH"], "FRESH"),
    gold: () => yahoo.fetchGoldFuturesSpot("FRESH"),
    russell: () => yahoo.fetchRussell2000Index("FRESH"),
    dxy: () => yahoo.fetchDxyIndex("FRESH"),
    usdjpy: () => yahoo.fetchUsdJpySpot("FRESH"),
    usdcnh: () => yahoo.fetchUsdCnhSpot("FRESH"),
    defillama: () => defillama.fetchDefiLlamaStablecoinObservations({
      mode: options.mode,
      acquisitionMode: "FRESH",
      ...(options.mode === "BACKFILL" ? { range: options.defillama } : {}),
    }),
    sosovalue: () => sosovalue.fetchSoSoValueBtcEtfFlowObservations({
      mode: options.mode,
      acquisitionMode: "FRESH",
      ...(options.mode === "BACKFILL" ? { range: options.sosovalue } : {}),
    }),
    cftc: () => cftc.fetchCftcGoldCotObservations({
      mode: options.mode,
      acquisitionMode: "FRESH",
      ...(options.mode === "BACKFILL" ? { range: options.cftc } : {}),
      ...(options.mode === "FORWARD" ? { releaseAware: options.cftcReleaseAware === true } : {}),
    }),
  };
}
