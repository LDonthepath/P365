import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { FredObservationQuery, MacroObservationInput } from "../data/fred";
import type { ProviderId, ProviderResult } from "../data/types";
import { cryptoMarketToObservations, macroToCanonicalRecords, P365_SOURCES } from "../domain/normalize";
import type { Evidence, Observation } from "../domain/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";

type MarketResult = ProviderResult<CryptoMarketObservationInput>;

export const HISTORICAL_INGESTION_PROVIDERS = ["coingecko", "gold", "dxy", "russell", "fred"] as const;
export type HistoricalIngestionProvider = typeof HISTORICAL_INGESTION_PROVIDERS[number];
export type HistoricalIngestionMode = "FORWARD" | "BACKFILL";

export type HistoricalIngestionOptions = {
  mode: HistoricalIngestionMode;
  providers: HistoricalIngestionProvider[];
  fred?: Omit<FredObservationQuery, "acquisitionMode" | "requireCompleteRange">;
};

export type HistoricalIngestionAcquisition = {
  coingecko: () => Promise<MarketResult>;
  fred: () => Promise<ProviderResult<MacroObservationInput>>;
  gold: () => Promise<MarketResult>;
  russell: () => Promise<MarketResult>;
  dxy: () => Promise<MarketResult>;
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

async function defaultDependencies(options: HistoricalIngestionOptions): Promise<{
  acquisition: HistoricalIngestionAcquisition;
  repositories: CanonicalRepositories;
}> {
  const [crypto, fred, yahoo, repositories] = await Promise.all([
    import("../data/crypto-market"),
    import("../data/fred"),
    import("../data/yahoo-finance-markets"),
    import("../repositories/dashboard-repository"),
  ]);
  return {
    acquisition: {
      coingecko: () => crypto.fetchCryptoMarketObservations(["BTC", "ETH"], "FRESH"),
      fred: () => fred.fetchFredMacroObservations({
        ...options.fred,
        acquisitionMode: "FRESH",
        requireCompleteRange: options.mode === "BACKFILL",
      }),
      gold: () => yahoo.fetchGoldFuturesSpot("FRESH"),
      russell: () => yahoo.fetchRussell2000Index("FRESH"),
      dxy: () => yahoo.fetchDxyIndex("FRESH"),
    },
    repositories: repositories.canonicalRepositories,
  };
}

function providerId(provider: HistoricalIngestionProvider): ProviderId {
  if (provider === "coingecko") return "coingecko";
  if (provider === "fred") return "fred";
  return "yahoo-finance";
}

function canonicalize(
  result: ProviderResult<unknown>,
  provider: HistoricalIngestionProvider,
): { observations: Observation[]; evidence: Evidence[] } {
  if (provider === "fred") {
    return macroToCanonicalRecords(result.data as MacroObservationInput[], P365_SOURCES.fred.id);
  }
  return cryptoMarketToObservations(
    result.data as CryptoMarketObservationInput[],
    provider === "coingecko" ? P365_SOURCES.coinGeckoMarket.id : P365_SOURCES.yahooFinance.id,
  );
}

function validateOptions(options: HistoricalIngestionOptions): void {
  if (options.providers.length === 0) throw new Error("At least one ingestion provider is required");
  if (options.mode === "BACKFILL" && options.providers.some((provider) => provider !== "fred")) {
    throw new Error("BACKFILL is currently supported only for fred");
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
): Promise<HistoricalIngestionProviderReport> {
  const result = await acquire(provider, acquisition);
  const canonical = canonicalize(result, provider);
  const normalized = canonical.observations.length;

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
    providers.map((provider) => executeProvider(provider, acquisition, repositories)),
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
