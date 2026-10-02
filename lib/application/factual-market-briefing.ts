import {
  factualBaselineChange,
  type FactualBaseline,
} from "../domain/baseline";
import type { EventSurpriseRelation } from "../domain/event-surprise";
import type {
  EventRepricingAssessmentStatus,
  EventRepricingDirection,
  EventRepricingResponseStatus,
} from "../domain/event-repricing";
import type { SnapshotComparisonQuality } from "../domain/snapshot-comparison";
import type { Observation } from "../domain/types";
import type {
  IntradayEventMonitorResult,
  IntradayPricingBaselineEvidence,
} from "./intraday-event-monitor";
import type { BriefingEventRepricingResult } from "./briefing-event-repricing";

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

export type BriefingEventSurprise = {
  eventIdentityKey: string;
  subject: string;
  jurisdiction: string;
  releaseAt: string;
  actual: number;
  expected: number;
  expectedType: string;
  unit: string;
  period: string;
  relation: Exclude<EventSurpriseRelation, "UNKNOWN">;
  sourceId: string;
  policy: string;
  causalAttribution: "NOT_EVALUATED";
};

export type BriefingRepricingResponse = {
  observationKey: string;
  seriesKey: string;
  status: EventRepricingResponseStatus;
  direction: EventRepricingDirection;
  measuredMagnitude: number | null;
  minimumMagnitude: number;
};

export type BriefingEventRepricing = {
  eventIdentityKey: string;
  subject: string;
  jurisdiction: string;
  releaseAt: string;
  role: "T_PLUS_5" | "T_PLUS_15" | "T_PLUS_30" | "T_PLUS_60";
  capturedAt: string;
  status: EventRepricingAssessmentStatus;
  quality: SnapshotComparisonQuality;
  contaminationStatus: "CLEAN" | "CONTAMINATED";
  responses: BriefingRepricingResponse[];
  policy: string;
  causalAttribution: "NOT_EVALUATED";
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
  eventSurprises: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    events: BriefingEventSurprise[];
    reason: string | null;
  };
  eventRepricing: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    events: BriefingEventRepricing[];
    reason: string | null;
  };
};

type ComposeFactualMarketBriefingInput = {
  baselines: Record<string, FactualBaseline>;
  observations: Observation[];
  asOf: string;
  intradayEventMonitor?: IntradayEventMonitorResult;
  eventRepricing?: BriefingEventRepricingResult;
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

function composeEventSurprises(
  result: IntradayEventMonitorResult | undefined,
): FactualMarketBriefing["eventSurprises"] {
  if (!result || result.status !== "OK") {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      events: [],
      reason: result?.status === "ERROR"
        ? "Perbandingan hasil dengan ekspektasi terbaru sedang tidak dapat dibaca."
        : "Belum ada event terbaru dengan surprise faktual yang dapat ditampilkan.",
    };
  }

  const events = result.data.flatMap((item): BriefingEventSurprise[] => {
    const surprise = item.surprise;
    if (
      surprise?.status !== "VALID"
      || surprise.actual === null
      || surprise.expected === null
      || surprise.expectedType === null
      || surprise.unit === null
      || surprise.period === null
      || surprise.relation === "UNKNOWN"
    ) {
      return [];
    }

    return [{
      eventIdentityKey: item.eventIdentityKey,
      subject: item.subject,
      jurisdiction: item.jurisdiction,
      releaseAt: item.t0,
      actual: surprise.actual,
      expected: surprise.expected,
      expectedType: surprise.expectedType,
      unit: surprise.unit,
      period: surprise.period,
      relation: surprise.relation,
      sourceId: surprise.sourceId,
      policy: surprise.policy,
      causalAttribution: surprise.causalAttribution,
    }];
  });

  return {
    evidenceStatus: events.length > 0 ? "AVAILABLE" : "INSUFFICIENT",
    reasoningStatus: "NOT_EVALUATED",
    events,
    reason: events.length > 0
      ? null
      : "Event terbaru belum memiliki surprise faktual berstatus VALID yang cukup untuk ditampilkan.",
  };
}


const REPRICING_ROLE_ORDER = ["T_PLUS_5", "T_PLUS_15", "T_PLUS_30", "T_PLUS_60"] as const;

function repricingRoleIndex(role: string): number {
  const index = REPRICING_ROLE_ORDER.indexOf(
    role as (typeof REPRICING_ROLE_ORDER)[number],
  );
  return index === -1 ? -1 : index;
}

function seriesKeyFromObservationKey(key: string): string {
  const parts = key.split(":");
  return parts.length >= 3 ? parts.slice(1, -1).join(":") : key;
}

function composeEventRepricing(
  result: BriefingEventRepricingResult | undefined,
): FactualMarketBriefing["eventRepricing"] {
  if (!result || result.status !== "OK") {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      events: [],
      reason: result?.status === "INSUFFICIENT"
        ? result.reason
        : result?.status === "ERROR"
          ? "Evidence repricing event terbaru sedang tidak dapat dibaca."
          : "Belum ada event terbaru dengan evidence repricing yang dapat ditampilkan.",
    };
  }

  const events = result.data.flatMap((item): BriefingEventRepricing[] => {
    const assessed = item.windows
      .filter((window) => window.status === "ASSESSED")
      .sort((a, b) => repricingRoleIndex(a.role) - repricingRoleIndex(b.role));
    const latest = assessed.at(-1);
    if (!latest || latest.status !== "ASSESSED") return [];

    const assessment = latest.assessment;
    return [{
      eventIdentityKey: item.eventIdentityKey,
      subject: item.subject,
      jurisdiction: item.jurisdiction,
      releaseAt: item.t0,
      role: latest.role,
      capturedAt: latest.capturedAt,
      status: assessment.status,
      quality: assessment.quality,
      contaminationStatus: assessment.contaminationStatus,
      responses: assessment.responses.map((response) => ({
        observationKey: response.observationKey,
        seriesKey: seriesKeyFromObservationKey(response.observationKey),
        status: response.status,
        direction: response.direction,
        measuredMagnitude: response.measuredMagnitude,
        minimumMagnitude: response.minimumMagnitude,
      })),
      policy: assessment.policy,
      causalAttribution: assessment.causalAttribution,
    }];
  });

  return {
    evidenceStatus: events.length > 0 ? "AVAILABLE" : "INSUFFICIENT",
    reasoningStatus: "NOT_EVALUATED",
    events,
    reason: events.length > 0
      ? null
      : "Belum ada horizon Observation aktual yang cocok persis dengan threshold RPR-002B untuk event terbaru.",
  };
}

/**
 * BRF-001A composes already-qualified evidence into briefing sections.
 *
 * Gate 1: factual Macro changes.
 * Gate 2: point-in-time expectation + PRE pricing baseline evidence.
 * Gate 3a: existing SUR-001 factual actual-vs-expectation evidence.
 * Gate 3b: RPR-001 threshold-governed repricing using frozen RPR-002B policy.
 *
 * It does not infer causality, decide surprise meaning, transmission,
 * confirmation, regime, invalidation, or trading action.
 */
export function composeFactualMarketBriefing({
  baselines,
  observations,
  asOf,
  intradayEventMonitor,
  eventRepricing,
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
    eventSurprises: composeEventSurprises(intradayEventMonitor),
    eventRepricing: composeEventRepricing(eventRepricing),
  };
}
