import {
  factualBaselineChange,
  type FactualBaseline,
} from "../domain/baseline";
import type { Observation } from "../domain/types";
import type {
  IntradayEventMonitorResult,
  IntradayPricingBaselineEvidence,
} from "./intraday-event-monitor";

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

export type BriefingExpectationBaseline = {
  status: string;
  expected: number;
  expectedType: string;
  unit: string;
  period: string;
  retrievedAt: string;
  sourceId: string;
  policy: string;
};

export type BriefingPricingBaseline = {
  status: string;
  seriesKey: string;
  value: number;
  unit: string | null;
  observedAt: string;
  retrievedAt: string;
  sourceId: string;
  policy: string;
};

export type BriefingEventBaseline = {
  eventIdentityKey: string;
  subject: string;
  jurisdiction: string;
  releaseAt: string;
  preCapturedAt: string;
  expectation: BriefingExpectationBaseline | null;
  pricing: BriefingPricingBaseline[];
};

export type FactualMarketBriefing = {
  asOf: string;
  whatChanged: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    items: FactualBriefingChange[];
    reason: string | null;
  };
  eventBaselines: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    events: BriefingEventBaseline[];
    reason: string | null;
  };
};

type ComposeFactualMarketBriefingInput = {
  baselines: Record<string, FactualBaseline>;
  observations: Observation[];
  asOf: string;
  intradayEventMonitor?: IntradayEventMonitorResult;
};

function observationSeriesId(observation: Observation): string | null {
  const value = observation.metadata?.seriesId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function priorityIndex(seriesId: string): number {
  const index = CHANGE_PRIORITY.indexOf(seriesId as (typeof CHANGE_PRIORITY)[number]);
  return index === -1 ? 999 : index;
}

function qualifiedPricing(
  pricing: IntradayPricingBaselineEvidence[],
): BriefingPricingBaseline[] {
  return pricing.flatMap((item) =>
    item.status === "VALID"
      && item.seriesKey
      && item.value !== null
      && item.observedAt
      && item.retrievedAt
      && item.sourceId
      ? [{
          status: item.status,
          seriesKey: item.seriesKey,
          value: item.value,
          unit: item.unit,
          observedAt: item.observedAt,
          retrievedAt: item.retrievedAt,
          sourceId: item.sourceId,
          policy: item.policy,
        }]
      : [],
  );
}

function composeEventBaselines(
  result: IntradayEventMonitorResult | undefined,
): FactualMarketBriefing["eventBaselines"] {
  if (!result || result.status !== "OK") {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      events: [],
      reason: result?.status === "ERROR"
        ? "Baseline event terbaru sedang tidak dapat dibaca."
        : "Belum ada event terbaru dengan baseline expectation/pricing yang dapat ditampilkan.",
    };
  }

  const events = result.data.flatMap((item): BriefingEventBaseline[] => {
    const baseline = item.baselineEvidence;
    if (!baseline) return [];

    const expectation = baseline.expectation;
    const qualifiedExpectation = expectation
      && expectation.status === "VALID"
      && expectation.expected !== null
      && expectation.expectedType
      && expectation.unit
      && expectation.period
      && expectation.retrievedAt
      && expectation.sourceId
      ? {
          status: expectation.status,
          expected: expectation.expected,
          expectedType: expectation.expectedType,
          unit: expectation.unit,
          period: expectation.period,
          retrievedAt: expectation.retrievedAt,
          sourceId: expectation.sourceId,
          policy: expectation.policy,
        }
      : null;
    const pricing = qualifiedPricing(baseline.pricing);

    if (!qualifiedExpectation && pricing.length === 0) return [];
    return [{
      eventIdentityKey: item.eventIdentityKey,
      subject: item.subject,
      jurisdiction: item.jurisdiction,
      releaseAt: item.t0,
      preCapturedAt: baseline.capturedAt,
      expectation: qualifiedExpectation,
      pricing,
    }];
  });

  return {
    evidenceStatus: events.length > 0 ? "AVAILABLE" : "INSUFFICIENT",
    reasoningStatus: "NOT_EVALUATED",
    events,
    reason: events.length > 0
      ? null
      : "Snapshot PRE tersedia, tetapi baseline expectation/pricing yang qualified belum cukup untuk ditampilkan.",
  };
}

/**
 * BRF-001A composes already-qualified evidence into briefing sections.
 *
 * Gate 1: factual Macro changes.
 * Gate 2: point-in-time expectation + PRE pricing baseline evidence.
 *
 * It does not decide materiality, surprise meaning, repricing, transmission,
 * confirmation, regime, invalidation, or trading action.
 */
export function composeFactualMarketBriefing({
  baselines,
  observations,
  asOf,
  intradayEventMonitor,
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
    eventBaselines: composeEventBaselines(intradayEventMonitor),
  };
}
