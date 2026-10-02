import {
  assessEventRepricing,
  type EventRepricingAssessment,
  type EventRepricingThreshold,
} from "../domain/event-repricing";
import type { QualifiedEventWindow } from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Event } from "../domain/types";
import type { ObservationRepository } from "../repositories/types";
import {
  compareRepositoryBackedEventWindowSnapshots,
  type EventWindowSnapshotComparison,
} from "./snapshot-comparison";

export type RepositoryBackedEventRepricing = {
  comparison: EventWindowSnapshotComparison;
  assessment: EventRepricingAssessment;
};

/**
 * Resolves canonical facts through CMP-001 and then applies RPR-001 thresholds.
 *
 * This boundary remains read-only. It neither persists a reasoning conclusion
 * nor activates Transmission, State, Risk, Regime, Intelligence, or trading
 * logic.
 */
export async function assessRepositoryBackedEventRepricing(input: {
  window: QualifiedEventWindow;
  before: MarketSnapshot;
  after: MarketSnapshot;
  events: Event[];
  observationRepository: ObservationRepository;
  thresholds: EventRepricingThreshold[];
}): Promise<RepositoryBackedEventRepricing> {
  const comparison = await compareRepositoryBackedEventWindowSnapshots({
    window: input.window,
    before: input.before,
    after: input.after,
    events: input.events,
    observationRepository: input.observationRepository,
  });

  const assessment = assessEventRepricing({
    windowId: comparison.windowId,
    eventIdentityKey: comparison.eventIdentityKey,
    beforeRole: comparison.beforeRole,
    afterRole: comparison.afterRole,
    contaminationStatus: comparison.contaminationStatus,
    contaminants: comparison.contaminants,
    comparison: comparison.comparison,
    thresholds: input.thresholds,
  });

  return {
    comparison,
    assessment,
  };
}
