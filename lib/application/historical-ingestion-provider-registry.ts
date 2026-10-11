import type { ProviderId, ProviderResult } from "../data/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { HistoricalIngestionAcquisition, HistoricalIngestionOptions, HistoricalIngestionProvider } from "./historical-ingestion-contract";

export async function defaultDependencies(options: HistoricalIngestionOptions): Promise<{
  acquisition: HistoricalIngestionAcquisition;
  repositories: CanonicalRepositories;
}> {
  const [binanceSpot, binanceBook, hyperliquidBook, crypto, cftc, defillama, fred, federalReserveSep, gdelt, sosovalue, yahoo, repositories] = await Promise.all([
    import("../data/binance-spot-flow"),
    import("../data/binance-order-book"),
    import("../data/hyperliquid-perp-order-book"),
    import("../data/crypto-market"),
    import("../data/cftc-gold-cot"),
    import("../data/defillama-stablecoins"),
    import("../data/fred"),
    import("../data/federal-reserve-sep"),
    import("../data/gdelt-gal"),
    import("../data/sosovalue-etf-flow"),
    import("../data/yahoo-finance-markets"),
    import("../repositories/dashboard-repository"),
  ]);
  return {
    acquisition: {
      "binance-spot": () => binanceSpot.fetchBinanceBtcSpotKlines({ limit: 3, acquisitionMode: "FRESH" }),
      "binance-book": () => binanceBook.fetchBinanceBtcOrderBook({ limit: 500, acquisitionMode: "FRESH" }),
      "hyperliquid-book": () => hyperliquidBook.fetchHyperliquidBtcPerpOrderBook({ acquisitionMode: "FRESH" }),
      coingecko: () => crypto.fetchCryptoMarketObservations(["BTC", "ETH"], "FRESH"),
      "coingecko-context": () => crypto.fetchCryptoMarketObservations(["BTC", "ETH"], "FRESH"),
      fred: () => fred.fetchFredMacroObservations({
        ...options.fred,
        acquisitionMode: "FRESH",
        requireCompleteRange: options.mode === "BACKFILL",
      }),
      "federal-reserve-sep": () => federalReserveSep.fetchFederalReserveSepObservations("FRESH"),
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
      gdelt: () => gdelt.fetchGdeltGalCandidateSnapshots({
        assets: ["BTC", "GOLD"],
        acquisitionMode: "FRESH",
      }),
    },
    repositories: repositories.canonicalRepositories,
  };
}

function providerId(provider: HistoricalIngestionProvider): ProviderId {
  if (provider === "coingecko" || provider === "coingecko-context") return "coingecko";
  if (provider === "fred") return "fred";
  if (provider === "federal-reserve-sep") return "federal-reserve";
  if (provider === "defillama") return "defillama";
  if (provider === "sosovalue") return "sosovalue";
  if (provider === "cftc") return "cftc";
  if (provider === "gdelt") return "gdelt";
  if (provider === "binance-spot" || provider === "binance-book") return "binance-spot";
  if (provider === "hyperliquid-book") return "hyperliquid";
  return "yahoo-finance";
}

export async function acquireHistoricalResult(
  provider: HistoricalIngestionProvider,
  acquisition: HistoricalIngestionAcquisition,
): Promise<ProviderResult<unknown>> {
  try {
    return await acquisition[provider]();
  } catch (error) {
    return {
      providerId: providerId(provider),
      status: "ERROR",
      data: [],
      retrievedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Provider acquisition failed",
    };
  }
}
