import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { HistoricalIngestionAcquisition, HistoricalIngestionOptions, HistoricalIngestionReport } from "./historical-ingestion-contract";
import { defaultDependencies } from "./historical-ingestion-provider-registry";
import { validateOptions } from "./historical-ingestion-options";
import { executeProvider } from "./historical-ingestion-executor";
import { RETAINED_MACRO_INGESTION_PROVIDERS } from "./historical-ingestion-macro-providers";

// Preserve the exact public surface consumed by cron and existing callers.
export {
  HISTORICAL_INGESTION_PROVIDERS,
  DEFILLAMA_MAX_BACKFILL_CALENDAR_DAYS,
  FRED_SELECTIVE_BACKFILL_MAX_CALENDAR_DAYS,
  defiLlamaBackfillRangeError,
  fredSelectiveBackfillRangeError,
} from "./historical-ingestion-contract";
export type {
  HistoricalIngestionProvider, HistoricalIngestionMode, HistoricalIngestionOptions,
  HistoricalIngestionAcquisition, HistoricalIngestionReport, HistoricalIngestionProviderReport,
  FredPhysicalWriteMetrics,
} from "./historical-ingestion-contract";

export async function runHistoricalIngestion(
  options: HistoricalIngestionOptions,
  dependencies: { acquisition?: HistoricalIngestionAcquisition; repositories?: CanonicalRepositories } = {},
): Promise<HistoricalIngestionReport> {
  validateOptions(options);
  // Retire default market acquisition before repository initialization, fetch,
  // normalization or persistence. Explicitly injected test doubles remain
  // available for historical contract regression fixtures.
  const allowed = new Set<string>(RETAINED_MACRO_INGESTION_PROVIDERS);
  const retired = [...new Set(options.providers)].filter((provider) => !allowed.has(provider));
  if (retired.length > 0 && !(dependencies.acquisition && dependencies.repositories)) {
    throw new Error(`Nonmacro historical ingestion is retired: ${retired.join(",")}`);
  }
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
