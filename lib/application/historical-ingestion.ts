import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DefiLlamaStablecoinBackfillRange, DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import type { FredObservationQuery, MacroObservationInput } from "../data/fred";
import type { ProviderId, ProviderResult } from "../data/types";
import { cryptoMarketToObservations, macroToCanonicalRecords, P365_SOURCES, stablecoinLiquidityToCanonicalRecords } from "../domain/normalize";
import type { Evidence, Observation } from "../domain/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";

type MarketResult = ProviderResult<CryptoMarketObservationInput>;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFILLAMA_MAX_BACKFILL_CALENDAR_DAYS = 35;

export const HISTORICAL_INGESTION_PROVIDERS = ["coingecko", "gold", "dxy", "russell", "fred", "defillama"] as const;
export type HistoricalIngestionProvider = typeof HISTORICAL_INGESTION_PROVIDERS[number];
export type HistoricalIngestionMode = "FORWARD" | "BACKFILL";

export type HistoricalIngestionOptions = {
  mode: HistoricalIngestionMode;
  providers: HistoricalIngestionProvider[];
  fred?: Omit<FredObservationQuery, "acquisitionMode" | "requireCompleteRange">;
  defillama?: DefiLlamaStablecoinBackfillRange;
};

export type HistoricalIngestionAcquisition = {
  coingecko: () => Promise<MarketResult>;
  fred: () => Promise<ProviderResult<MacroObservationInput>>;
  gold: () => Promise<MarketResult>;
  russell: () => Promise<MarketResult>;
  dxy: () => Promise<MarketResult>;
  defillama: () => Promise<ProviderResult<DefiLlamaStablecoinObservationInput>>;
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
  const [crypto, defillama, fred, yahoo, repositories] = await Promise.all([
    import("../data/crypto-market"),
    import("../data/defillama-stablecoins"),
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
      defillama: () => defillama.fetchDefiLlamaStablecoinObservations({
        mode: options.mode,
        acquisitionMode: "FRESH",
        ...(options.mode === "BACKFILL" ? { range: options.defillama } : {}),
      }),
    },
    repositories: repositories.canonicalRepositories,
  };
}

function providerId(provider: HistoricalIngestionProvider): ProviderId {
  if (provider === "coingecko") return "coingecko";
  if (provider === "fred") return "fred";
  if (provider === "defillama") return "defillama";
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
  if (provider === "defillama") {
    const rows = result.data as DefiLlamaStablecoinObservationInput[];
    const selected = mode === "FORWARD" && rows.length > 0
      ? [rows.reduce((latest, row) => row.observedAt > latest.observedAt ? row : latest)]
      : rows;
    return stablecoinLiquidityToCanonicalRecords(
      selected,
    );
  }
  return cryptoMarketToObservations(
    result.data as CryptoMarketObservationInput[],
    provider === "coingecko" ? P365_SOURCES.coinGeckoMarket.id : P365_SOURCES.yahooFinance.id,
  );
}

function validateOptions(options: HistoricalIngestionOptions): void {
  if (options.providers.length === 0) throw new Error("At least one ingestion provider is required");
  if (options.mode === "BACKFILL") {
    if (options.providers.length !== 1 || !["fred", "defillama"].includes(options.providers[0])) {
      throw new Error("BACKFILL requires exactly one supported provider: fred or defillama");
    }
    if (options.providers[0] === "fred" && !options.fred) {
      throw new Error("FRED BACKFILL requires explicit options");
    }
    if (options.providers[0] === "defillama" && !options.defillama) {
      throw new Error("DefiLlama BACKFILL requires explicit options");
    }
    if (options.providers[0] === "defillama" && options.defillama) {
      const rangeError = defiLlamaBackfillRangeError(options.defillama);
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
