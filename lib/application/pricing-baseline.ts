import {
  pricingRepositoryFailureBaseline,
  selectPricingBaseline,
  validatePricingBaselineRequest,
  type PricingBaseline,
  type PricingBaselineRequest,
} from "../domain/pricing-baseline";
import type { HistoricalObservationRepository } from "../repositories/types";

const PRICING_HISTORY_LIMIT = 500;

/**
 * Selects a provider-scoped canonical PRICING observation that was both
 * observed and available to P365 by the requested as-of instant.
 *
 * The caller owns maxObservationAgeMs because intraday, session, and daily
 * reasoning require different tolerances. This function does not infer
 * policy probabilities, surprise, repricing, or transmission.
 */
export async function buildRepositoryBackedPricingBaseline(
  request: PricingBaselineRequest,
  repository: HistoricalObservationRepository,
): Promise<PricingBaseline> {
  validatePricingBaselineRequest(request);

  try {
    const candidates = await repository.findHistory({
      identity: request.identity,
      sourceId: request.sourceId,
      observedAtOnOrBefore: request.asOf,
      retrievedAtOnOrBefore: request.asOf,
      order: "DESC",
      limit: PRICING_HISTORY_LIMIT,
    });
    return selectPricingBaseline(request, candidates);
  } catch {
    return pricingRepositoryFailureBaseline(request);
  }
}
