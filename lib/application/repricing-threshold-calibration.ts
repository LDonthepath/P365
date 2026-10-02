import type { EventWindowHistoricalContext } from "../domain/event-window-historical-context";
import {
  calibrateRepricingThresholdCandidate,
  type RepricingThresholdCalibrationEvidence,
} from "../domain/repricing-threshold-calibration";

export type EventWindowRepricingCalibrationDataset = {
  eventIdentityKey: string;
  windowId: string;
  comparisonId: string;
  afterRole: EventWindowHistoricalContext["afterRole"];
  knowledgeAt: string;
  candidates: RepricingThresholdCalibrationEvidence[];
  missingObservationKeys: string[];
  causalAttribution: "NOT_EVALUATED";
};

/**
 * RPR-002A calibration-only adapter.
 *
 * Reuses HIST-001C evidence already carrying exact series/source/horizon lineage.
 * It does not call RPR-001 or convert candidates into production thresholds.
 */
export function buildEventWindowRepricingCalibrationDataset(
  context: EventWindowHistoricalContext,
): EventWindowRepricingCalibrationDataset {
  const candidates = context.series
    .map((series) => calibrateRepricingThresholdCandidate({
      observationKey: series.observationKey,
      seriesKey: series.seriesKey,
      sourceId: series.sourceId,
      comparisonHorizonMs: series.comparisonHorizonMs,
      historicalBaseline: series.historicalBaseline,
    }))
    .sort((a, b) => a.observationKey.localeCompare(b.observationKey));

  return {
    eventIdentityKey: context.eventIdentityKey,
    windowId: context.windowId,
    comparisonId: context.comparisonId,
    afterRole: context.afterRole,
    knowledgeAt: context.knowledgeAt,
    candidates,
    missingObservationKeys: [...context.missingObservationKeys].sort(),
    causalAttribution: "NOT_EVALUATED",
  };
}
