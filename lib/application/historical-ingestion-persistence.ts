import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { HistoricalIngestionProvider, FredPhysicalWriteMetrics } from "./historical-ingestion-contract";
import type { CanonicalHistoricalBatch } from "./historical-ingestion-normalization";

/**
 * Only this adapter owns persistence semantics and FRED physical write receipts.
 * It intentionally preserves separate evidence-before-observation writes and
 * the legacy "accepted" counts in dispatcher reports.
 */
export async function persistHistoricalBatch(
  provider: HistoricalIngestionProvider,
  repositories: CanonicalRepositories,
  canonical: CanonicalHistoricalBatch,
  metrics?: FredPhysicalWriteMetrics,
): Promise<void> {
  const isFred = provider === "fred";
  const bothSupportReceipt = isFred
    && typeof repositories.evidence.saveManyWithReceipt === "function"
    && typeof repositories.observations.saveManyWithReceipt === "function";
  const coordinatedFred = isFred && process.env.P365_FRED_TRANSACTIONAL_REVISIONS === "1";
  if (metrics && coordinatedFred) {
    if (typeof repositories.evidence.saveManyWithReceipt !== "function"
      || typeof repositories.observations.saveManyWithFredRevisionReceipt !== "function") {
      throw new Error("FRED coordinated revision writer unavailable");
    }
    // Evidence and Observation remain separate requests; neither the
    // API nor these receipts imply atomic persistence across both families.
    const ev = await repositories.evidence.saveManyWithReceipt(canonical.evidence);
    metrics.evidence.inserted = ev.inserted;
    metrics.evidence.duplicates = ev.duplicates;
    const obs = await repositories.observations.saveManyWithFredRevisionReceipt(canonical.observations);
    metrics.observations.inserted = obs.inserted;
    metrics.observations.duplicates = obs.duplicates;
    metrics.revised = obs.revised;
    metrics.revisionAssessment = obs.revisionAssessment;
    metrics.source = "FRED_COORDINATED_RPC";
  } else if (metrics && bothSupportReceipt) {
    const ev = await repositories.evidence.saveManyWithReceipt!(canonical.evidence);
    metrics.evidence.inserted = ev.inserted;
    metrics.evidence.duplicates = ev.duplicates;
    const obs = await repositories.observations.saveManyWithReceipt!(canonical.observations);
    metrics.observations.inserted = obs.inserted;
    metrics.observations.duplicates = obs.duplicates;
    metrics.source = "POSTGREST_RETURNING_KEYS";
    // No new observations implies zero revisions. Otherwise a prior-version
    // history lookup is needed, which is intentionally outside this write path.
    if (obs.inserted === 0) metrics.revised = 0;
  } else {
    await repositories.evidence.saveMany(canonical.evidence);
    await repositories.observations.saveMany(canonical.observations);
  }
}
