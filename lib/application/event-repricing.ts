import {
  assessEventRepricing,
  type EventRepricingAssessment,
  type EventRepricingThreshold,
} from "../domain/event-repricing";
import type { QualifiedEventWindow } from "../domain/event-window";
import { productionRepricingThresholdFor } from "../domain/repricing-threshold-policy";
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

export type RepositoryBackedProductionEventRepricing =
  | {
      status: "ASSESSED";
      comparison: EventWindowSnapshotComparison;
      assessment: EventRepricingAssessment;
    }
  | {
      status: "INSUFFICIENT_THRESHOLDS";
      comparison: EventWindowSnapshotComparison;
      reason: string;
    };

export function resolveProductionRepricingThresholds(
  comparison: EventWindowSnapshotComparison,
): EventRepricingThreshold[] {
  const thresholds = new Map<string, EventRepricingThreshold>();

  for (const change of comparison.comparison.observationChanges) {
    if (!change.beforeObservedAt || !change.afterObservedAt) continue;

    const beforeObservedAt = Date.parse(change.beforeObservedAt);
    const afterObservedAt = Date.parse(change.afterObservedAt);
    if (
      !Number.isFinite(beforeObservedAt)
      || !Number.isFinite(afterObservedAt)
      || afterObservedAt <= beforeObservedAt
    ) {
      continue;
    }

    const threshold = productionRepricingThresholdFor({
      observationKey: change.key,
      afterRole: comparison.afterRole,
      comparisonHorizonMs: afterObservedAt - beforeObservedAt,
    });
    if (threshold) thresholds.set(threshold.observationKey, threshold);
  }

  return [...thresholds.values()].sort(
    (a, b) => a.observationKey.localeCompare(b.observationKey),
  );
}

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


/**
 * Applies only RPR-002B production thresholds whose exact Observation horizon
 * matches the factual CMP-001 change. No rounding, tolerance, nearest-horizon
 * fallback, or default threshold is allowed here.
 */
export async function assessRepositoryBackedProductionEventRepricing(input: {
  window: QualifiedEventWindow;
  before: MarketSnapshot;
  after: MarketSnapshot;
  events: Event[];
  observationRepository: ObservationRepository;
}): Promise<RepositoryBackedProductionEventRepricing> {
  const comparison = await compareRepositoryBackedEventWindowSnapshots({
    window: input.window,
    before: input.before,
    after: input.after,
    events: input.events,
    observationRepository: input.observationRepository,
  });

  const thresholds = resolveProductionRepricingThresholds(comparison);
  if (!thresholds.length) {
    return {
      status: "INSUFFICIENT_THRESHOLDS",
      comparison,
      reason:
        "No RPR-002B threshold matches the exact canonical Observation horizon for this event window.",
    };
  }

  return {
    status: "ASSESSED",
    comparison,
    assessment: assessEventRepricing({
      windowId: comparison.windowId,
      eventIdentityKey: comparison.eventIdentityKey,
      beforeRole: comparison.beforeRole,
      afterRole: comparison.afterRole,
      contaminationStatus: comparison.contaminationStatus,
      contaminants: comparison.contaminants,
      comparison: comparison.comparison,
      thresholds,
    }),
  };
}
