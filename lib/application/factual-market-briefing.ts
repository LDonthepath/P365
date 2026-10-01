import {
  factualBaselineChange,
  type FactualBaseline,
} from "../domain/baseline";
import type { Observation } from "../domain/types";

const CHANGE_PRIORITY = ["DGS2", "DGS10", "DFII10", "T10YIE", "T10Y2Y"] as const;
const MAX_VISIBLE_CHANGES = 4;

export type BriefingEvidenceStatus = "AVAILABLE" | "INSUFFICIENT";
export type BriefingReasoningStatus = "NOT_EVALUATED";

export type FactualBriefingChange = {
  seriesId: string;
  subject: string;
  unit: string;
  currentValue: string;
  baselineValue: string;
  changeValue: number;
  currentObservedAt: string;
  baselineObservedAt: string;
  sourceId: string;
};

export type FactualMarketBriefing = {
  asOf: string;
  whatChanged: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    items: FactualBriefingChange[];
    reason: string | null;
  };
};

type ComposeFactualMarketBriefingInput = {
  baselines: Record<string, FactualBaseline>;
  observations: Observation[];
  asOf: string;
};

function observationSeriesId(observation: Observation): string | null {
  const value = observation.metadata?.seriesId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function priorityIndex(seriesId: string): number {
  const index = CHANGE_PRIORITY.indexOf(seriesId as (typeof CHANGE_PRIORITY)[number]);
  return index === -1 ? 999 : index;
}

/**
 * BRF-001A Gate 1 only.
 *
 * Composes already-qualified factual Macro baselines into one briefing section.
 * It does not decide materiality, direction, causality, surprise, repricing,
 * transmission, confirmation, regime, invalidation, or trading action.
 */
export function composeFactualMarketBriefing({
  baselines,
  observations,
  asOf,
}: ComposeFactualMarketBriefingInput): FactualMarketBriefing {
  const changes = Object.entries(baselines)
    .flatMap(([seriesId, baseline]) => {
      const changeValue = factualBaselineChange(baseline);
      if (
        baseline.status !== "VALID"
        || changeValue === null
        || baseline.baselineValue === null
        || baseline.baselineObservedAt === null
      ) {
        return [];
      }

      const observation = observations.find((item) => item.id === baseline.currentObservationId)
        ?? observations.find((item) => observationSeriesId(item) === seriesId);

      return [{
        seriesId,
        subject: observation?.subject ?? seriesId,
        unit: typeof observation?.metadata?.unit === "string" ? observation.metadata.unit : "",
        currentValue: baseline.currentValue,
        baselineValue: baseline.baselineValue,
        changeValue,
        currentObservedAt: baseline.currentObservedAt,
        baselineObservedAt: baseline.baselineObservedAt,
        sourceId: baseline.sourceId,
      }];
    })
    .sort((a, b) => priorityIndex(a.seriesId) - priorityIndex(b.seriesId))
    .slice(0, MAX_VISIBLE_CHANGES);

  return {
    asOf,
    whatChanged: {
      evidenceStatus: changes.length > 0 ? "AVAILABLE" : "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      items: changes,
      reason: changes.length > 0
        ? null
        : "Belum ada factual baseline Macro berstatus VALID yang cukup untuk diringkas pada cutoff ini.",
    },
  };
}
