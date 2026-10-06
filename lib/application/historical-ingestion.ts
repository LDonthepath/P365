import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DefiLlamaStablecoinBackfillRange, DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import type { FredObservationQuery, MacroObservationInput } from "../data/fred";
import type { FederalReserveSepObservationInput } from "../data/federal-reserve-sep";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import type { BinanceSpotKline } from "../data/binance-spot-flow";
import type { BinanceOrderBookSnapshot } from "../data/binance-order-book";
import type { HyperliquidPerpOrderBookSnapshot } from "../data/hyperliquid-perp-order-book";
import { soSoValueBackfillRangeError, type SoSoValueBtcEtfFlowBackfillRange, type SoSoValueBtcEtfFlowObservationInput } from "../data/sosovalue-etf-flow";
import { cftcGoldCotBackfillRangeError, type CftcGoldCotBackfillRange, type CftcGoldCotObservationInput } from "../data/cftc-gold-cot";
import type { ProviderId, ProviderResult } from "../data/types";
import { btcEtfFlowToCanonicalRecords, cftcGoldCotToCanonicalRecords, cryptoMarketToObservations, federalReserveSepToCanonicalRecords, macroToCanonicalRecords, P365_SOURCES, stablecoinLiquidityToCanonicalRecords } from "../domain/normalize";
import { gdeltGalSnapshotsToEvidence } from "./gdelt-gal-history";
import { buildBinanceBtcSpotFlowWindow } from "./btc-spot-flow";
import { btcSpotFlowWindowsToEvidence } from "./btc-spot-flow-history";
import { buildBinanceBtcOrderBookLiquiditySnapshot } from "./btc-order-book-liquidity";
import { buildHyperliquidBtcPerpLiquiditySnapshot } from "./btc-perp-order-book-liquidity";
import {
  binanceBtcSpotOrderBookSnapshotToEvidence,
  hyperliquidBtcPerpOrderBookSnapshotToEvidence,
} from "./btc-order-book-history";
import type { Evidence, Observation } from "../domain/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";

type MarketResult = ProviderResult<CryptoMarketObservationInput>;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFILLAMA_MAX_BACKFILL_CALENDAR_DAYS = 35;

export const HISTORICAL_INGESTION_PROVIDERS = ["coingecko", "coingecko-context", "gold", "dxy", "russell", "usdjpy", "usdcnh", "fred", "federal-reserve-sep", "defillama", "sosovalue", "cftc", "gdelt", "binance-spot", "binance-book", "hyperliquid-book"] as const;
export type HistoricalIngestionProvider = typeof HISTORICAL_INGESTION_PROVIDERS[number];
export type HistoricalIngestionMode = "FORWARD" | "BACKFILL";

export type HistoricalIngestionOptions = {
  mode: HistoricalIngestionMode;
  providers: HistoricalIngestionProvider[];
  fred?: Omit<FredObservationQuery, "acquisitionMode" | "requireCompleteRange">;
  defillama?: DefiLlamaStablecoinBackfillRange;
  sosovalue?: SoSoValueBtcEtfFlowBackfillRange;
  cftc?: CftcGoldCotBackfillRange;
};

export type HistoricalIngestionAcquisition = {
  coingecko: () => Promise<MarketResult>;
  "coingecko-context": () => Promise<MarketResult>;
  fred: () => Promise<ProviderResult<MacroObservationInput>>;
  "federal-reserve-sep": () => Promise<ProviderResult<FederalReserveSepObservationInput>>;
  gold: () => Promise<MarketResult>;
  russell: () => Promise<MarketResult>;
  dxy: () => Promise<MarketResult>;
  usdjpy: () => Promise<MarketResult>;
  usdcnh: () => Promise<MarketResult>;
  defillama: () => Promise<ProviderResult<DefiLlamaStablecoinObservationInput>>;
  sosovalue: () => Promise<ProviderResult<SoSoValueBtcEtfFlowObservationInput>>;
  cftc: () => Promise<ProviderResult<CftcGoldCotObservationInput>>;
  gdelt: () => Promise<ProviderResult<GdeltGalFeedSnapshot>>;
  "binance-spot": () => Promise<ProviderResult<BinanceSpotKline>>;
  "binance-book": () => Promise<ProviderResult<BinanceOrderBookSnapshot>>;
  "hyperliquid-book": () => Promise<ProviderResult<HyperliquidPerpOrderBookSnapshot>>;
};

export type HistoricalIngestionProviderReport = {
  provider: HistoricalIngestionProvider;
  status: ProviderResult<unknown>["status"] | "PERSISTENCE_ERROR";
  acquired: number;
  normalized: number;
  persisted: number;
  persistedEvidence: number;
  error?: string;
};

export type HistoricalIngestionReport = {
  mode: HistoricalIngestionMode;
  status: "SUCCESS" | "PARTIAL" | "EMPTY" | "FAILED";
  providers: HistoricalIngestionProviderReport[];
  persistedObservations: number;
  persistedEvidence: number;
};

export function defiLlamaBackfillRangeError(range: DefiLlamaStablecoinBackfillRange): string | null {
  const from = Date.parse(`${range.from}T00:00:00.000Z`);
  const to = Date.parse(`${range.to}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(range.from)
    || !/^\d{4}-\d{2}-\d{2}$/.test(range.to)
    || !Number.isFinite(from)
    || !Number.isFinite(to)
    || new Date(from).toISOString().slice(0, 10) !== range.from
    || new Date(to).toISOString().slice(0, 10) !== range.to
    || from > to
  ) {
    return "DefiLlama BACKFILL requires valid from/to date bounds";
  }
  const inclusiveCalendarDays = (to - from) / DAY_MS + 1;
  return inclusiveCalendarDays > DEFILLAMA_MAX_BACKFILL_CALENDAR_DAYS
    ? `DefiLlama BACKFILL is limited to ${DEFILLAMA_MAX_BACKFILL_CALENDAR_DAYS} calendar days`
    : null;
}

async function defaultDependencies(options: HistoricalIngestionOptions): Promise<{
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

function canonicalize(
  result: ProviderResult<unknown>,
  provider: HistoricalIngestionProvider,
  mode: HistoricalIngestionMode,
): { observations: Observation[]; evidence: Evidence[] } {
  if (provider === "fred") {
    return macroToCanonicalRecords(result.data as MacroObservationInput[], P365_SOURCES.fred.id);
  }
  if (provider === "federal-reserve-sep") {
    return federalReserveSepToCanonicalRecords(result.data as FederalReserveSepObservationInput[]);
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
  if (provider === "gdelt") {
    return {
      observations: [],
      evidence: gdeltGalSnapshotsToEvidence({
        snapshots: result.data as GdeltGalFeedSnapshot[],
        retrievedAt: result.retrievedAt,
      }),
    };
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

function validateOptions(options: HistoricalIngestionOptions): void {
  if (options.providers.length === 0) throw new Error("At least one ingestion provider is required");
  if (options.mode === "BACKFILL") {
    if (options.providers.length !== 1 || !["fred", "defillama", "sosovalue", "cftc"].includes(options.providers[0])) {
      throw new Error("BACKFILL requires exactly one supported provider: fred, defillama, sosovalue, or cftc");
    }
    if (options.providers[0] === "fred" && !options.fred) {
      throw new Error("FRED BACKFILL requires explicit options");
    }
    if (options.providers[0] === "defillama" && !options.defillama) {
      throw new Error("DefiLlama BACKFILL requires explicit options");
    }
    if (options.providers[0] === "sosovalue" && !options.sosovalue) {
      throw new Error("SoSoValue BACKFILL requires explicit options");
    }
    if (options.providers[0] === "cftc" && !options.cftc) {
      throw new Error("CFTC Gold COT BACKFILL requires explicit options");
    }
    if (options.providers[0] === "defillama" && options.defillama) {
      const rangeError = defiLlamaBackfillRangeError(options.defillama);
      if (rangeError) throw new Error(rangeError);
    }
    if (options.providers[0] === "sosovalue" && options.sosovalue) {
      const rangeError = soSoValueBackfillRangeError(options.sosovalue);
      if (rangeError) throw new Error(rangeError);
    }
    if (options.providers[0] === "cftc" && options.cftc) {
      const rangeError = cftcGoldCotBackfillRangeError(options.cftc);
      if (rangeError) throw new Error(rangeError);
    }
  }
}

async function acquire(
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

async function executeProvider(
  provider: HistoricalIngestionProvider,
  acquisition: HistoricalIngestionAcquisition,
  repositories: CanonicalRepositories,
  mode: HistoricalIngestionMode,
): Promise<HistoricalIngestionProviderReport> {
  const result = await acquire(provider, acquisition);
  const canonical = canonicalize(result, provider, mode);
  const normalized = Math.max(canonical.observations.length, canonical.evidence.length);

  if (normalized === 0 && canonical.evidence.length === 0) {
    return {
      provider,
      status: result.status,
      acquired: result.data.length,
      normalized,
      persisted: 0,
      persistedEvidence: 0,
      error: result.status === "ERROR" || result.status === "UNAVAILABLE" ? result.message : undefined,
    };
  }

  try {
    await repositories.evidence.saveMany(canonical.evidence);
    await repositories.observations.saveMany(canonical.observations);
    return {
      provider,
      status: result.status,
      acquired: result.data.length,
      normalized,
      persisted: canonical.observations.length,
      persistedEvidence: canonical.evidence.length,
      error: result.status === "ERROR" || result.status === "UNAVAILABLE" ? result.message : undefined,
    };
  } catch (error) {
    return {
      provider,
      status: "PERSISTENCE_ERROR",
      acquired: result.data.length,
      normalized,
      persisted: 0,
      persistedEvidence: 0,
      error: error instanceof Error ? error.message : "Canonical persistence failed",
    };
  }
}

export async function runHistoricalIngestion(
  options: HistoricalIngestionOptions,
  dependencies: { acquisition?: HistoricalIngestionAcquisition; repositories?: CanonicalRepositories } = {},
): Promise<HistoricalIngestionReport> {
  validateOptions(options);
  const defaults = dependencies.acquisition && dependencies.repositories
    ? { acquisition: dependencies.acquisition, repositories: dependencies.repositories }
    : await defaultDependencies(options);
  const acquisition = dependencies.acquisition ?? defaults.acquisition;
  const repositories = dependencies.repositories ?? defaults.repositories;
  const providers = [...new Set(options.providers)];
  const reports = await Promise.all(
    providers.map((provider) => executeProvider(provider, acquisition, repositories, options.mode)),
  );
  const persistedObservations = reports.reduce((total, report) => total + report.persisted, 0);
  const persistedEvidence = reports.reduce((total, report) => total + report.persistedEvidence, 0);
  const failures = reports.filter((report) =>
    report.status === "ERROR" || report.status === "UNAVAILABLE" || report.status === "PERSISTENCE_ERROR");
  const hasPersisted = persistedObservations > 0 || persistedEvidence > 0;
  const status = hasPersisted
    ? failures.length > 0 ? "PARTIAL" : "SUCCESS"
    : failures.length === reports.length ? "FAILED" : failures.length > 0 ? "PARTIAL" : "EMPTY";

  return { mode: options.mode, status, providers: reports, persistedObservations, persistedEvidence };
}
