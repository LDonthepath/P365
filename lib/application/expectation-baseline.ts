import {
  expectationBaselineCutoff,
  expectationRepositoryFailureBaseline,
  selectExpectationBaseline,
  validateExpectationBaselineRequest,
  type ExpectationBaseline,
  type ExpectationBaselineRequest,
} from "../domain/expectation-baseline";
import type { HistoricalEconomicEventResultRepository } from "../repositories/types";

const EXPECTATION_HISTORY_LIMIT = 500;

/**
 * Selects the latest provider-qualified expectation snapshot that P365 had
 * obtained before the requested as-of/release cutoff.
 *
 * This does not compute surprise and never treats FORECAST as CONSENSUS.
 */
export async function buildRepositoryBackedExpectationBaseline(
  request: ExpectationBaselineRequest,
  repository: HistoricalEconomicEventResultRepository,
): Promise<ExpectationBaseline> {
  validateExpectationBaselineRequest(request);
  const cutoff = expectationBaselineCutoff(request);

  try {
    const candidates = await repository.findHistory({
      eventIdentityKey: request.eventIdentityKey,
      sourceId: request.sourceId,
      ...(request.expectedType ? { expectedType: request.expectedType } : {}),
      retrievedAtOnOrBefore: cutoff,
      order: "DESC",
      limit: EXPECTATION_HISTORY_LIMIT,
    });
    return selectExpectationBaseline(request, candidates);
  } catch {
    return expectationRepositoryFailureBaseline(request);
  }
}
