import {
  factualBaselineChange,
  type FactualBaseline,
} from "../domain/baseline";
import type { EventSurpriseRelation } from "../domain/event-surprise";
import type {
  ConfirmationContributionJudgement,
  ConfirmationResolution,
} from "../domain/confirmation-evidence";
import type {
  EventRepricingAssessmentStatus,
  EventRepricingDirection,
  EventRepricingResponseStatus,
} from "../domain/event-repricing";
import type { SnapshotComparisonQuality } from "../domain/snapshot-comparison";
import type { Event, Observation } from "../domain/types";
import type {
  IntradayEventMonitorResult,
  IntradayPricingBaselineEvidence,
} from "./intraday-event-monitor";
import type { BriefingEventRepricingResult } from "./briefing-event-repricing";
import type { BriefingConfirmationResult } from "./briefing-confirmation";
import type { MaterialMoveMonitorReadModel } from "./material-move-monitor";
import type { RatesInflationReadModel, RatesSeriesPoint, UnifiedMacroPoint } from "./rates-inflation";
import type { NetLiquidityPoint, NetLiquidityReadModel } from "./net-liquidity";
import type { CentralBankBalanceSheetReadModel } from "./central-bank-balance-sheets";
import type {
  CreditFinancialConditionsPoint,
  CreditFinancialConditionsReadModel,
} from "./credit-financial-conditions";

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

export type BriefingConfirmationEvidence = {
  evidenceClass: "FLOW";
  source: "BTC_ETF_FLOW";
  status: "QUALIFIED" | "UNRESOLVED";
  judgement: ConfirmationContributionJudgement | null;
  observedAt: string | null;
  knownAt: string | null;
  reason: string;
};

export type BriefingConfirmation = {
  eventIdentityKey: string;
  subject: string;
  jurisdiction: string;
  releaseAt: string;
  role: "T_PLUS_5" | "T_PLUS_15" | "T_PLUS_30" | "T_PLUS_60";
  capturedAt: string;
  targetAsset: "BTC";
  targetDirection: "UP" | "DOWN";
  resolution: ConfirmationResolution;
  supportingClassCount: number;
  contradictingClassCount: number;
  directionalClassCount: number;
  minimumDirectionalClasses: number;
  evidence: BriefingConfirmationEvidence[];
  causalAttribution: "NOT_EVALUATED";
};

export type BriefingNextCatalystEvent = {
  eventIdentityKey: string;
  eventId: string;
  subject: string;
  jurisdiction: string | null;
  sourceId: string;
};

export type BriefingNextCatalystSlot = {
  scheduledAt: string;
  precision: "TIME" | "DATE_ONLY";
  events: BriefingNextCatalystEvent[];
};

export type BriefingMarketMove = {
  asset: MaterialMoveMonitorReadModel["assets"][number]["asset"];
  seriesKey: MaterialMoveMonitorReadModel["assets"][number]["seriesKey"];
  sourceId: string;
  observedAt: string | null;
  observationQuality?: Observation["quality"];
  marketContext: MaterialMoveMonitorReadModel["assets"][number]["marketContext"];
  status: MaterialMoveMonitorReadModel["assets"][number]["status"];
  hasMaterialMove: boolean;
  horizons: MaterialMoveMonitorReadModel["assets"][number]["horizons"];
  evidence: MaterialMoveMonitorReadModel["assets"][number]["evidence"];
  causalAttribution: "NOT_EVALUATED";
};

export type BriefingResolutionStatus =
  | "MARKET_DATA_INSUFFICIENT"
  | "NO_MATERIAL_MOVE"
  | "MATERIAL_MOVE_EVIDENCE_INCOMPLETE"
  | "MATERIAL_MOVE_EVIDENCE_COMPLETE";

export type BriefingResolution = {
  status: BriefingResolutionStatus;
  reasoningStatus: BriefingReasoningStatus;
  materialAssets: Array<BriefingMarketMove["asset"]>;
  evidenceCompleteness: "EVIDENCE_COMPLETE" | "EVIDENCE_INCOMPLETE" | null;
  statement: string;
  driverStatement: string;
  watchStatement: string;
};

export type FactualMarketBriefing = {
  asOf: string;
  marketMoves: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    materialMoveCount: number;
    items: BriefingMarketMove[];
    reason: string | null;
  };
  ratesPolicy: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    unifiedMacro: UnifiedMacroPoint[];
    gold: RatesSeriesPoint[];
    bitcoin: RatesSeriesPoint[];
    reason: string | null;
  };
  creditConditions: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    items: CreditFinancialConditionsPoint[];
    reason: string | null;
  };
  centralBankBalanceSheets: CentralBankBalanceSheetReadModel;
  netLiquidity: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    latest: NetLiquidityPoint | null;
    change1wBillionsUsd: number | null;
    change1wFrom: string | null;
    change4wBillionsUsd: number | null;
    change4wFrom: string | null;
    reason: string | null;
  };
  resolution: BriefingResolution;
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
  confirmation: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    item: BriefingConfirmation | null;
    reason: string | null;
  };
  nextCatalyst: {
    evidenceStatus: BriefingEvidenceStatus;
    reasoningStatus: BriefingReasoningStatus;
    slot: BriefingNextCatalystSlot | null;
    reason: string | null;
  };
};

type ComposeFactualMarketBriefingInput = {
  baselines: Record<string, FactualBaseline>;
  observations: Observation[];
  asOf: string;
  intradayEventMonitor?: IntradayEventMonitorResult;
  eventRepricing?: BriefingEventRepricingResult;
  confirmation?: BriefingConfirmationResult;
  upcomingHighImpactEvents?: Event[];
  materialMoveMonitor?: MaterialMoveMonitorReadModel;
  ratesPolicy?: RatesInflationReadModel;
  creditConditions?: CreditFinancialConditionsReadModel;
  netLiquidity?: NetLiquidityReadModel;
  centralBankBalanceSheets?: CentralBankBalanceSheetReadModel;
};

function observationSeriesId(observation: Observation): string | null {
  const value = observation.metadata?.seriesId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function priorityIndex(seriesId: string): number {
  const index = CHANGE_PRIORITY.indexOf(seriesId as (typeof CHANGE_PRIORITY)[number]);
  return index === -1 ? 999 : index;
}

function composeMarketMoves(
  result: MaterialMoveMonitorReadModel | undefined,
): FactualMarketBriefing["marketMoves"] {
  if (!result) {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      materialMoveCount: 0,
      items: [],
      reason: "Belum ada assessment durable BTC/Gold yang cukup untuk market-first briefing.",
    };
  }

  const items: BriefingMarketMove[] = result.assets.map((item) => ({
    asset: item.asset,
    seriesKey: item.seriesKey,
    sourceId: item.sourceId,
    observedAt: item.observedAt,
    observationQuality: item.observationQuality,
    marketContext: item.marketContext,
    status: item.status,
    hasMaterialMove: item.hasMaterialMove,
    horizons: item.horizons,
    evidence: item.evidence,
    causalAttribution: item.causalAttribution,
  }));
  const materialMoveCount = items.filter((item) => item.hasMaterialMove).length;

  return {
    evidenceStatus: items.length > 0 && result.status !== "UNAVAILABLE" ? "AVAILABLE" : "INSUFFICIENT",
    reasoningStatus: "NOT_EVALUATED",
    materialMoveCount,
    items,
    reason: items.length === 0
      ? "Belum ada assessment durable BTC/Gold pada cutoff briefing."
      : result.status === "UNAVAILABLE"
        ? "Observasi durable BTC/Gold belum tersedia pada cutoff briefing."
        : result.status === "PARTIAL"
        ? "Sebagian assessment BTC/Gold belum tersedia; briefing mempertahankan gap tersebut secara eksplisit."
        : null,
  };
}

const BRIEFING_RATES_POLICY_KEYS = {
  gold: ["DTWEXBGS"],
  bitcoin: ["WRESBAL", "SOFR_IORB_SPREAD"],
} as const;

function composeRatesPolicy(
  result: RatesInflationReadModel | undefined,
): FactualMarketBriefing["ratesPolicy"] {
  if (!result || result.status !== "OK") {
    return {
      evidenceStatus: result?.unifiedMacro?.some((point) => point.latest) ? "AVAILABLE" : "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      unifiedMacro: result?.unifiedMacro ?? [],
      gold: [],
      bitcoin: [],
      reason: result?.status === "UNAVAILABLE"
        ? result.reason
        : "Fakta Rates & Policy belum tersedia pada cutoff briefing.",
    };
  }

  const byKey = new Map(result.series.map((point) => [point.seriesKey, point]));
  const gold = BRIEFING_RATES_POLICY_KEYS.gold.flatMap((key) => {
    const point = byKey.get(key);
    return point ? [point] : [];
  });
  const bitcoin = BRIEFING_RATES_POLICY_KEYS.bitcoin.flatMap((key) => {
    const point = byKey.get(key);
    return point ? [point] : [];
  });
  const expected = BRIEFING_RATES_POLICY_KEYS.gold.length + BRIEFING_RATES_POLICY_KEYS.bitcoin.length;
  const available = gold.length + bitcoin.length;

  return {
    evidenceStatus: available > 0 || result.unifiedMacro?.some((point) => point.latest) ? "AVAILABLE" : "INSUFFICIENT",
    reasoningStatus: "NOT_EVALUATED",
    unifiedMacro: result.unifiedMacro ?? [],
    gold,
    bitcoin,
    reason: available === expected
      ? null
      : available > 0
        ? "Sebagian fakta Rates & Policy belum tersedia; briefing mempertahankan gap tersebut."
        : "Fakta Rates & Policy untuk Gold dan Bitcoin belum tersedia pada cutoff briefing.",
  };
}

function composeCreditConditions(
  result: CreditFinancialConditionsReadModel | undefined,
): FactualMarketBriefing["creditConditions"] {
  if (!result || result.status !== "OK") {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      items: [],
      reason: result?.status === "UNAVAILABLE"
        ? result.reason
        : "Fakta Credit & Financial Conditions belum tersedia pada cutoff briefing.",
    };
  }

  return {
    evidenceStatus: result.series.length > 0 ? "AVAILABLE" : "INSUFFICIENT",
    reasoningStatus: "NOT_EVALUATED",
    items: result.series,
    reason: result.reason,
  };
}

function composeNetLiquidity(
  result: NetLiquidityReadModel | undefined,
): FactualMarketBriefing["netLiquidity"] {
  if (!result || result.status !== "OK") {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      latest: null,
      change1wBillionsUsd: null,
      change1wFrom: null,
      change4wBillionsUsd: null,
      change4wFrom: null,
      reason: result?.status === "UNAVAILABLE"
        ? result.reason
        : "Proxy Net Liquidity belum tersedia pada cutoff briefing.",
    };
  }

  return {
    evidenceStatus: "AVAILABLE",
    reasoningStatus: "NOT_EVALUATED",
    latest: result.latest,
    change1wBillionsUsd: result.change1wBillionsUsd,
    change1wFrom: result.change1wFrom,
    change4wBillionsUsd: result.change4wBillionsUsd,
    change4wFrom: result.change4wFrom,
    reason: result.change1wBillionsUsd === null || !result.change1wFrom
      ? "Riwayat sekitar satu minggu belum cukup untuk pembanding utama."
      : null,
  };
}

function assetNames(assets: Array<BriefingMarketMove["asset"]>): string {
  return assets.map((asset) => asset === "BTC" ? "Bitcoin" : "Gold").join(" dan ");
}

function composeBriefingResolution(input: {
  marketMoves: FactualMarketBriefing["marketMoves"];
  nextCatalyst: FactualMarketBriefing["nextCatalyst"];
}): BriefingResolution {
  if (input.marketMoves.evidenceStatus !== "AVAILABLE") {
    return {
      status: "MARKET_DATA_INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      materialAssets: [],
      evidenceCompleteness: null,
      statement: "Penilaian Bitcoin/Gold belum cukup untuk menyusun kesimpulan briefing pada batas waktu ini.",
      driverStatement: "Pendorong pasar belum dievaluasi karena penilaian pasar belum cukup.",
      watchStatement: input.nextCatalyst.evidenceStatus === "AVAILABLE"
        ? "Pantau peristiwa berdampak tinggi berikutnya yang sudah tercatat dan pembaruan penilaian pasar."
        : "Pantau pembaruan penilaian pasar dan peristiwa berdampak tinggi berikutnya saat data tersimpan tersedia.",
    };
  }

  const materialMoves = input.marketMoves.items.filter((item) => item.hasMaterialMove);
  const materialAssets = materialMoves.map((item) => item.asset);

  if (materialMoves.length === 0) {
    return {
      status: "NO_MATERIAL_MOVE",
      reasoningStatus: "NOT_EVALUATED",
      materialAssets: [],
      evidenceCompleteness: null,
      statement:
        "Belum ada pergerakan material Bitcoin atau Gold pada batas waktu ini. Paket investigasi tidak diaktifkan karena tidak ada pemicu pergerakan yang memenuhi ambang historis.",
      driverStatement: "Tidak ada pendorong yang dievaluasi karena belum ada pergerakan material yang menjadi target investigasi.",
      watchStatement: input.nextCatalyst.evidenceStatus === "AVAILABLE"
        ? "Pantau peristiwa berdampak tinggi berikutnya yang sudah tercatat dan apakah muncul pergerakan material baru."
        : "Pantau perubahan Bitcoin/Gold berikutnya dan peristiwa berdampak tinggi saat tersedia pada data tersimpan.",
    };
  }

  const evidenceIncomplete = materialMoves.some((item) =>
    !item.evidence || item.evidence.evidenceCompleteness !== "EVIDENCE_COMPLETE"
  );
  const evidenceCompleteness = evidenceIncomplete
    ? "EVIDENCE_INCOMPLETE" as const
    : "EVIDENCE_COMPLETE" as const;
  const names = assetNames(materialAssets);

  return {
    status: evidenceIncomplete
      ? "MATERIAL_MOVE_EVIDENCE_INCOMPLETE"
      : "MATERIAL_MOVE_EVIDENCE_COMPLETE",
    reasoningStatus: "NOT_EVALUATED",
    materialAssets,
    evidenceCompleteness,
    statement: evidenceIncomplete
      ? `${names} mengalami pergerakan material pada batas waktu ini. Bukti investigasi tersedia, tetapi belum lengkap dalam cakupan aktif.`
      : `${names} mengalami pergerakan material pada batas waktu ini. Bukti investigasi lengkap dalam cakupan aktif.`,
    driverStatement:
      "Pendorong pasar belum dapat ditetapkan dari bukti faktual yang tersedia; hubungan sebab-akibat belum dievaluasi.",
    watchStatement: input.nextCatalyst.evidenceStatus === "AVAILABLE"
      ? "Pantau peristiwa berdampak tinggi berikutnya yang sudah tercatat, bukti yang masih belum tersedia, dan pergerakan material berikutnya."
      : "Pantau bukti yang masih belum tersedia serta pergerakan material berikutnya.",
  };
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


function composeConfirmation(
  result: BriefingConfirmationResult | undefined,
): FactualMarketBriefing["confirmation"] {
  if (!result || result.status !== "OK") {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      item: null,
      reason: result?.status === "INSUFFICIENT"
        ? result.reason
        : "Belum ada target BTC repricing yang qualified untuk confirmation evidence.",
    };
  }

  return {
    evidenceStatus: "AVAILABLE",
    reasoningStatus: "NOT_EVALUATED",
    item: {
      eventIdentityKey: result.eventIdentityKey,
      subject: result.subject,
      jurisdiction: result.jurisdiction,
      releaseAt: result.releaseAt,
      role: result.role,
      capturedAt: result.capturedAt,
      targetAsset: "BTC",
      targetDirection: result.targetDirection,
      resolution: result.assessment.resolution,
      supportingClassCount: result.assessment.supportingClassCount,
      contradictingClassCount: result.assessment.contradictingClassCount,
      directionalClassCount: result.assessment.directionalClassCount,
      minimumDirectionalClasses: result.assessment.minimumDirectionalClasses,
      evidence: result.evidence.map((item) =>
        item.status === "QUALIFIED"
          ? {
              evidenceClass: item.evidenceClass,
              source: item.source,
              status: item.status,
              judgement: item.judgement,
              observedAt: item.observedAt,
              knownAt: item.knownAt,
              reason: item.reason,
            }
          : {
              evidenceClass: item.evidenceClass,
              source: item.source,
              status: item.status,
              judgement: null,
              observedAt: null,
              knownAt: null,
              reason: item.reason,
            },
      ),
      causalAttribution: result.assessment.causalAttribution,
    },
    reason: result.assessment.resolution === "INSUFFICIENT_EVIDENCE"
      ? result.assessment.reason
        ?? "Belum ada dua independent directional evidence classes."
      : null,
  };
}


const DATE_ONLY_EVENT_SOURCE_IDS = new Set(["federal-reserve"]);
const MAX_NEXT_CATALYST_EVENTS = 4;

function utcDateKey(value: string): string | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

function composeNextCatalyst(input: {
  events: Event[] | undefined;
  asOf: string;
}): FactualMarketBriefing["nextCatalyst"] {
  const asOfMs = Date.parse(input.asOf);
  if (!Number.isFinite(asOfMs)) {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      slot: null,
      reason: "Cutoff briefing tidak valid untuk memilih event berikutnya.",
    };
  }

  const asOfDate = new Date(asOfMs).toISOString().slice(0, 10);
  const slots = new Map<string, {
    sortMs: number;
    scheduledAt: string;
    precision: "TIME" | "DATE_ONLY";
    events: BriefingNextCatalystEvent[];
    subjects: Set<string>;
  }>();

  for (const event of input.events ?? []) {
    if (event.importance !== "HIGH" || !event.scheduledAt) continue;

    const scheduledMs = Date.parse(event.scheduledAt);
    const retrievedMs = Date.parse(event.retrievedAt);
    if (
      !Number.isFinite(scheduledMs)
      || !Number.isFinite(retrievedMs)
      || retrievedMs > asOfMs
    ) {
      continue;
    }

    const dateOnly = DATE_ONLY_EVENT_SOURCE_IDS.has(event.sourceId);
    const eventDate = utcDateKey(event.scheduledAt);
    if (!eventDate) continue;

    if (dateOnly) {
      if (eventDate < asOfDate) continue;
    } else if (scheduledMs < asOfMs) {
      continue;
    }

    const minuteMs = scheduledMs - (scheduledMs % 60_000);
    const scheduledAt = dateOnly
      ? eventDate + "T00:00:00.000Z"
      : new Date(minuteMs).toISOString();
    const key = dateOnly
      ? "date:" + eventDate
      : "time:" + scheduledAt;
    const sortMs = Date.parse(scheduledAt);

    let slot = slots.get(key);
    if (!slot) {
      slot = {
        sortMs,
        scheduledAt,
        precision: dateOnly ? "DATE_ONLY" : "TIME",
        events: [],
        subjects: new Set<string>(),
      };
      slots.set(key, slot);
    }

    const normalizedSubject = event.subject.trim().toLowerCase();
    if (!normalizedSubject || slot.subjects.has(normalizedSubject)) continue;
    slot.subjects.add(normalizedSubject);
    slot.events.push({
      eventIdentityKey: event.identity?.key ?? event.id,
      eventId: event.id,
      subject: event.subject,
      jurisdiction: event.jurisdiction ?? null,
      sourceId: event.sourceId,
    });
  }

  const first = [...slots.values()]
    .sort((a, b) =>
      a.sortMs - b.sortMs
      || a.scheduledAt.localeCompare(b.scheduledAt)
    )[0];

  if (!first) {
    return {
      evidenceStatus: "INSUFFICIENT",
      reasoningStatus: "NOT_EVALUATED",
      slot: null,
      reason:
        "Belum ada event HIGH mendatang dalam daftar durable yang sudah dimuat.",
    };
  }

  const events = first.events
    .sort((a, b) =>
      (a.jurisdiction ?? "").localeCompare(b.jurisdiction ?? "")
      || a.subject.localeCompare(b.subject)
      || a.eventId.localeCompare(b.eventId)
    )
    .slice(0, MAX_NEXT_CATALYST_EVENTS);

  return {
    evidenceStatus: "AVAILABLE",
    reasoningStatus: "NOT_EVALUATED",
    slot: {
      scheduledAt: first.scheduledAt,
      precision: first.precision,
      events,
    },
    reason: null,
  };
}

/**
 * BRF-001A composes already-qualified evidence into briefing sections.
 * BRF-002A makes the briefing market-first by composing the existing
 * MOVE-003A/B/C read model before event-centric detail.
 * BRF-002D adds a deterministic factual resolution over the already-composed
 * MOVE evidence without promoting availability into causal attribution.
 *
 * Gate 1: factual Macro changes.
 * Gate 2: point-in-time expectation + PRE pricing baseline evidence.
 * Gate 3a: existing SUR-001 factual actual-vs-expectation evidence.
 * Gate 3b: RPR-001 threshold-governed repricing using frozen RPR-002B policy.
 * Gate 6: CONF-001A composition using only already-qualified evidence adapters.
 * Briefing completion: next HIGH-impact catalyst from already-loaded durable events.
 *
 * It does not infer causality, decide surprise meaning, transmission,
 * regime, invalidation, or trading action.
 */
export function composeFactualMarketBriefing({
  baselines,
  observations,
  asOf,
  intradayEventMonitor,
  eventRepricing,
  confirmation,
  upcomingHighImpactEvents,
  materialMoveMonitor,
  ratesPolicy,
  creditConditions,
  netLiquidity,
  centralBankBalanceSheets,
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

  const marketMoves = composeMarketMoves(materialMoveMonitor);
  const nextCatalyst = composeNextCatalyst({
    events: upcomingHighImpactEvents,
    asOf,
  });

  return {
    asOf,
    marketMoves,
    ratesPolicy: composeRatesPolicy(ratesPolicy),
    creditConditions: composeCreditConditions(creditConditions),
    netLiquidity: composeNetLiquidity(netLiquidity),
    centralBankBalanceSheets: centralBankBalanceSheets ?? {
      asOf,
      items: [
        { seriesKey: "ECBASSETSW", label: "Neraca Eurosystem (ECB)", displayUnit: "juta EUR", cadence: "WEEKLY", status: "MISSING", latest: null, previous: null, changeFromPrevious: null },
        { seriesKey: "JPNASSETS", label: "Neraca Bank of Japan", displayUnit: "100 juta JPY", cadence: "MONTHLY", status: "MISSING", latest: null, previous: null, changeFromPrevious: null },
      ],
    },
    resolution: composeBriefingResolution({
      marketMoves,
      nextCatalyst,
    }),
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
    confirmation: composeConfirmation(confirmation),
    nextCatalyst,
  };
}
