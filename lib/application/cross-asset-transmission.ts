import {
  assessCrossAssetTransmission,
  type CrossAssetTransmissionAssessment,
  type CrossAssetTransmissionRuleInput,
} from "../domain/cross-asset-transmission";
import type { EventRepricingThreshold } from "../domain/event-repricing";
import type { QualifiedEventWindow } from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Event } from "../domain/types";
import type { ObservationRepository } from "../repositories/types";
import {
  assessRepositoryBackedEventRepricing,
  type RepositoryBackedEventRepricing,
} from "./event-repricing";

export type RepositoryBackedCrossAssetTransmission = {
  repricing: RepositoryBackedEventRepricing;
  transmission: CrossAssetTransmissionAssessment;
};

/**
 * Reuses the complete CMP-001 -> RPR-001 chain and applies TRN-001 relationship
 * rules without creating a parallel canonical-resolution path.
 *
 * This boundary remains read-only. It does not persist transmission conclusions,
 * infer causality, activate State/Regime/Risk/Intelligence, or produce trading
 * instructions.
 */
export async function assessRepositoryBackedCrossAssetTransmission(input: {
  window: QualifiedEventWindow;
  before: MarketSnapshot;
  after: MarketSnapshot;
  events: Event[];
  observationRepository: ObservationRepository;
  thresholds: EventRepricingThreshold[];
  rules: CrossAssetTransmissionRuleInput[];
}): Promise<RepositoryBackedCrossAssetTransmission> {
  const repricing = await assessRepositoryBackedEventRepricing({
    window: input.window,
    before: input.before,
    after: input.after,
    events: input.events,
    observationRepository: input.observationRepository,
    thresholds: input.thresholds,
  });

  const transmission = assessCrossAssetTransmission({
    repricing: repricing.assessment,
    rules: input.rules,
  });

  return {
    repricing,
    transmission,
  };
}
