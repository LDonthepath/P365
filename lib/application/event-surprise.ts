import {
  assessEventSurprise,
  eventSurpriseRepositoryFailureAssessment,
  validateEventSurpriseRequest,
  type EventSurpriseAssessment,
  type EventSurpriseRequest,
} from "../domain/event-surprise";
import type { HistoricalEconomicEventResultRepository } from "../repositories/types";
import { buildRepositoryBackedExpectationBaseline } from "./expectation-baseline";

const EVENT_SURPRISE_HISTORY_LIMIT = 500;

/**
 * Builds SUR-001 from the existing EXP-001 expectation selector plus durable
 * EventResult history. The actual outcome is constrained by canonical
 * retrievedAt availability and can never be selected before the qualified
 * release instant or after the caller's as-of cutoff.
 *
 * This boundary is read-only. It does not persist surprise conclusions, apply
 * materiality thresholds, infer market direction, or activate repricing,
 * transmission, State, Risk, Regime, Intelligence, or trading logic.
 */
export async function assessRepositoryBackedEventSurprise(
  request: EventSurpriseRequest,
  repository: HistoricalEconomicEventResultRepository,
): Promise<EventSurpriseAssessment> {
  const { releaseAtMs, asOfMs } = validateEventSurpriseRequest(request);

  const expectation = await buildRepositoryBackedExpectationBaseline(
    request,
    repository,
  );

  if (asOfMs < releaseAtMs) {
    return assessEventSurprise({
      request,
      expectation,
      candidates: [],
    });
  }

  try {
    const candidates = await repository.findHistory({
      eventIdentityKey: request.eventIdentityKey,
      sourceId: request.sourceId,
      retrievedAtOnOrAfter: new Date(releaseAtMs).toISOString(),
      retrievedAtOnOrBefore: new Date(asOfMs).toISOString(),
      order: "DESC",
      limit: EVENT_SURPRISE_HISTORY_LIMIT,
    });

    return assessEventSurprise({
      request,
      expectation,
      candidates,
    });
  } catch {
    return eventSurpriseRepositoryFailureAssessment(
      request,
      expectation,
    );
  }
}
