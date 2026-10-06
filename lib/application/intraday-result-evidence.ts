import type { EconomicEventResult } from "../domain/event-result";
import type { Evidence } from "../domain/types";
import type { HistoricalEvidenceRepository } from "../repositories/types";

// An operational enrichment budget, not a market/materiality threshold.
const OPTIONAL_EVIDENCE_TIMEOUT_MS = 500;
const RESPONSE_RESERVE_MS = 50;

export async function resolveIntradayResultEvidence(
  repository: HistoricalEvidenceRepository,
  result: EconomicEventResult | undefined,
  eventIdentityKey: string,
  latestCapturedAt: string,
  deadline = Date.now() + OPTIONAL_EVIDENCE_TIMEOUT_MS + RESPONSE_RESERVE_MS,
): Promise<Evidence | null> {
  const cutoff = Date.parse(latestCapturedAt);
  if (!result?.evidenceId || !Number.isFinite(cutoff)) return null;
  const budget = Math.min(OPTIONAL_EVIDENCE_TIMEOUT_MS, deadline - Date.now() - RESPONSE_RESERVE_MS);
  if (budget <= 0) return null;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, budget);
    });
    // Use the indexed canonical ID already supplied by EventResult. Do not scan
    // unrelated Evidence to discover the result's optional display multiplier.
    const history = await Promise.race([
      repository.findHistory({
        evidenceId: result.evidenceId,
        sourceId: result.sourceId,
        kind: "EVENT",
        metadataEquals: { eventIdentityKey },
        retrievedAtOnOrBefore: latestCapturedAt,
        order: "DESC",
        limit: 1,
      }, { signal: controller.signal }),
      timedOut,
    ]);
    const evidence = history?.[0];
    if (!evidence) return null;
    const retrievedAt = Date.parse(evidence.retrievedAt);
    return evidence.id === result.evidenceId
      && evidence.sourceId === result.sourceId
      && evidence.kind === "EVENT"
      && evidence.metadata?.eventIdentityKey === eventIdentityKey
      && Number.isFinite(retrievedAt)
      && retrievedAt <= cutoff
      ? evidence : null;
  } catch (error) {
    console.error(
      "Intraday event multiplier evidence read failed closed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
