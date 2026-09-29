import type { CrossAssetTransmissionRuleInput } from "../domain/cross-asset-transmission";
import type { EventExpectedType } from "../domain/event-result";
import type { EventRepricingThreshold } from "../domain/event-repricing";
import {
  buildEventResponseEvidenceBundle,
  type EventResponseEvidenceBundle,
} from "../domain/event-response-evidence";
import type { QualifiedEventWindow } from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Event } from "../domain/types";
import type {
  HistoricalEconomicEventResultRepository,
  ObservationRepository,
} from "../repositories/types";
import {
  assessRepositoryBackedCrossAssetTransmission,
  type RepositoryBackedCrossAssetTransmission,
} from "./cross-asset-transmission";
import { assessRepositoryBackedEventSurprise } from "./event-surprise";

export type RepositoryBackedEventResponseEvidence = {
  surprise: EventResponseEvidenceBundle["surprise"];
  repricing: RepositoryBackedCrossAssetTransmission["repricing"];
  transmission: EventResponseEvidenceBundle["transmission"];
  bundle: EventResponseEvidenceBundle;
};

/**
 * Reuses SUR-001 and the complete CMP-001 -> RPR-001 -> TRN-001 chain and binds
 * them to one post-event Snapshot knowledge cutoff.
 *
 * The caller still owns RPR thresholds, TRN relationship methodology, and the
 * expectation provider/type. EVR-001 introduces no defaults or interpretation.
 */
export async function buildRepositoryBackedEventResponseEvidence(input: {
  window: QualifiedEventWindow;
  before: MarketSnapshot;
  after: MarketSnapshot;
  events: Event[];
  observationRepository: ObservationRepository;
  eventResultRepository: HistoricalEconomicEventResultRepository;
  surpriseSourceId: string;
  surpriseExpectedType?: EventExpectedType;
  thresholds: EventRepricingThreshold[];
  rules: CrossAssetTransmissionRuleInput[];
}): Promise<RepositoryBackedEventResponseEvidence> {
  if (!input.surpriseSourceId.trim()) {
    throw new Error(
      "Event Response Evidence requires an explicit surprise expectation source.",
    );
  }

  const response = await assessRepositoryBackedCrossAssetTransmission({
    window: input.window,
    before: input.before,
    after: input.after,
    events: input.events,
    observationRepository: input.observationRepository,
    thresholds: input.thresholds,
    rules: input.rules,
  });

  const surprise = await assessRepositoryBackedEventSurprise(
    {
      eventIdentityKey: input.window.eventIdentityKey,
      sourceId: input.surpriseSourceId,
      releaseAt: input.window.t0,
      asOf: input.after.capturedAt,
      ...(input.surpriseExpectedType
        ? { expectedType: input.surpriseExpectedType }
        : {}),
    },
    input.eventResultRepository,
  );

  const bundle = buildEventResponseEvidenceBundle({
    surprise,
    repricing: response.repricing.assessment,
    transmission: response.transmission,
  });

  return {
    surprise,
    repricing: response.repricing,
    transmission: response.transmission,
    bundle,
  };
}
