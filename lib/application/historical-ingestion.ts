import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { FredObservationQuery, MacroObservationInput } from "../data/fred";
import type { ProviderId, ProviderResult } from "../data/types";
import { cryptoMarketToObservations, macroToCanonicalRecords, P365_SOURCES } from "../domain/normalize";
import type { Evidence, Observation } from "../domain/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";

type YahooResult = ProviderResult<CryptoMarketObservationInput>;
export type HistoricalIngestionMode = "FORWARD" | "BACKFILL";

export type HistoricalIngestionOptions = {
  mode?: HistoricalIngestionMode;
  fred?: FredObservationQuery;
};

export type HistoricalIngestionAcquisition = {
  coingecko: () => Promise<ProviderResult<CryptoMarketObservationInput>>;
  fred: () => Promise<ProviderResult<MacroObservationInput>>;
  gold: () => Promise<YahooResult>;
  russell: () => Promise<YahooResult>;
  dxy: () => Promise<YahooResult>;
};

export type HistoricalIngestionProviderReport = {
  provider: string;
  status: ProviderResult<unknown>["status"] | "PERSISTENCE_ERROR";
  acquired: number;
  persisted: number;
  message?: string;
};

export type HistoricalIngestionReport = {
  mode: HistoricalIngestionMode;
  status: "SUCCESS" | "PARTIAL" | "EMPTY" | "FAILED";
  providers: HistoricalIngestionProviderReport[];
  persistedObservations: number;
  persistedEvidence: number;
};

let activeRun: Promise<HistoricalIngestionReport> | null = null;

async function defaultDependencies(options: HistoricalIngestionOptions): Promise<{ acquisition: HistoricalIngestionAcquisition; repositories: CanonicalRepositories }> {
  const [{ fetchCryptoMarketObservations }, { fetchFredMacroObservations }, { fetchDxyIndex, fetchGoldFuturesSpot, fetchRussell2000Index }, repositories] = await Promise.all([
    import("../data/crypto-market"),
    import("../data/fred"),
    import("../data/yahoo-finance-markets"),
    import("../repositories/dashboard-repository"),
  ]);
  return {
    acquisition: {
      coingecko: fetchCryptoMarketObservations,
      fred: () => fetchFredMacroObservations(options.fred),
      gold: fetchGoldFuturesSpot,
      russell: fetchRussell2000Index,
      dxy: fetchDxyIndex,
    },
    repositories: repositories.canonicalRepositories,
  };
}

function canonicalize(result: ProviderResult<unknown>, provider: keyof HistoricalIngestionAcquisition): { observations: Observation[]; evidence: Evidence[] } {
  if (provider === "fred") return macroToCanonicalRecords(result.data as MacroObservationInput[], P365_SOURCES.fred.id);
  return cryptoMarketToObservations(result.data as CryptoMarketObservationInput[], provider === "coingecko" ? P365_SOURCES.coinGeckoMarket.id : P365_SOURCES.yahooFinance.id);
}

async function execute(
  acquisition: HistoricalIngestionAcquisition,
  repositories: CanonicalRepositories,
  options: HistoricalIngestionOptions,
): Promise<HistoricalIngestionReport> {
  const providers: Array<{ name: keyof HistoricalIngestionAcquisition; fetch: () => Promise<ProviderResult<unknown>> }> = [
    { name: "coingecko", fetch: acquisition.coingecko },
    { name: "fred", fetch: () => acquisition.fred() },
    { name: "gold", fetch: acquisition.gold },
    { name: "russell", fetch: acquisition.russell },
    { name: "dxy", fetch: acquisition.dxy },
  ];

  const results = await Promise.all(providers.map(async ({ name, fetch }) => {
    try {
      return { name, result: await fetch() };
    } catch (error) {
      const providerId: ProviderId = name === "coingecko" ? "coingecko" : name === "fred" ? "fred" : "yahoo-finance";
      return { name, result: { providerId, status: "ERROR" as const, data: [], retrievedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "Provider acquisition failed" } };
    }
  }));
  const reports: HistoricalIngestionProviderReport[] = [];
  let persistedObservations = 0;
  let persistedEvidence = 0;
  let persistenceFailed = false;

  for (const { name, result } of results) {
    const canonical = canonicalize(result, name);
    if (canonical.observations.length === 0 && canonical.evidence.length === 0) {
      reports.push({ provider: name, status: result.status, acquired: result.data.length, persisted: 0, message: result.message });
      continue;
    }
    try {
      await repositories.evidence.saveMany(canonical.evidence);
      await repositories.observations.saveMany(canonical.observations);
      persistedObservations += canonical.observations.length;
      persistedEvidence += canonical.evidence.length;
      reports.push({ provider: name, status: result.status, acquired: result.data.length, persisted: canonical.observations.length, message: result.message });
    } catch (error) {
      persistenceFailed = true;
      reports.push({ provider: name, status: "PERSISTENCE_ERROR", acquired: result.data.length, persisted: 0, message: error instanceof Error ? error.message : "Canonical persistence failed" });
    }
  }

  const acquisitionFailures = reports.filter((report) => ["ERROR", "UNAVAILABLE", "PERSISTENCE_ERROR"].includes(report.status));
  const hasSuccess = reports.some((report) => report.persisted > 0);
  const status = persistenceFailed ? "FAILED" : hasSuccess && acquisitionFailures.length > 0 ? "PARTIAL" : hasSuccess ? "SUCCESS" : reports.some((report) => report.status === "EMPTY") ? "EMPTY" : "PARTIAL";
  return { mode: options.mode ?? "FORWARD", status, providers: reports, persistedObservations, persistedEvidence };
}

export async function runHistoricalIngestion(
  options: HistoricalIngestionOptions = {},
  dependencies: { acquisition?: HistoricalIngestionAcquisition; repositories?: CanonicalRepositories } = {},
): Promise<HistoricalIngestionReport> {
  if (activeRun) return activeRun;
  const run = async (): Promise<HistoricalIngestionReport> => {
    const defaults = dependencies.acquisition && dependencies.repositories
      ? { acquisition: dependencies.acquisition, repositories: dependencies.repositories }
      : await defaultDependencies(options).then((value) => ({ acquisition: dependencies.acquisition ?? value.acquisition, repositories: dependencies.repositories ?? value.repositories }));
    return execute(defaults.acquisition, defaults.repositories, options);
  };
  activeRun = run().finally(() => { activeRun = null; });
  return activeRun;
}
