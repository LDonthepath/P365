import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { HistoricalIngestionAcquisition, HistoricalIngestionMode, HistoricalIngestionProvider, HistoricalIngestionProviderReport, FredPhysicalWriteMetrics } from "./historical-ingestion-contract";
import { acquireHistoricalResult } from "./historical-ingestion-provider-registry";
import { canonicalizeHistoricalResult } from "./historical-ingestion-normalization";
import { persistHistoricalBatch } from "./historical-ingestion-persistence";

export async function executeProvider(
  provider: HistoricalIngestionProvider,
  acquisition: HistoricalIngestionAcquisition,
  repositories: CanonicalRepositories,
  mode: HistoricalIngestionMode,
): Promise<HistoricalIngestionProviderReport> {
  const result = await acquireHistoricalResult(provider, acquisition);
  const canonical = canonicalizeHistoricalResult(result, provider, mode);
  const normalized = Math.max(canonical.observations.length, canonical.evidence.length);
  const isFred = provider === "fred";
  const metrics: FredPhysicalWriteMetrics | undefined = isFred
    ? {
        source: "NOT_EVALUATED",
        observations: { submitted: canonical.observations.length, inserted: null, duplicates: null },
        evidence: { submitted: canonical.evidence.length, inserted: null, duplicates: null },
        revised: null,
        revisionAssessment: "NOT_EVALUATED",
      }
    : undefined;

  if (normalized === 0 && canonical.evidence.length === 0) {
    if (metrics) {
      metrics.observations.inserted = 0;
      metrics.observations.duplicates = 0;
      metrics.evidence.inserted = 0;
      metrics.evidence.duplicates = 0;
      metrics.revised = 0;
    }
    return {
      provider,
      status: result.status,
      acquired: result.data.length,
      normalized,
      persisted: 0,
      persistedEvidence: 0,
      ...(metrics ? { writeMetrics: metrics } : {}),
      error: result.status === "ERROR" || result.status === "UNAVAILABLE" ? result.message : undefined,
    };
  }

  try {
    await persistHistoricalBatch(provider, repositories, canonical, metrics);
    return {
      provider,
      status: result.status,
      acquired: result.data.length,
      normalized,
      persisted: canonical.observations.length,
      persistedEvidence: canonical.evidence.length,
      ...(metrics ? { writeMetrics: metrics } : {}),
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
      ...(metrics ? { writeMetrics: metrics } : {}),
      error: error instanceof Error ? error.message : "Canonical persistence failed",
    };
  }
}
