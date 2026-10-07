import type { Observation } from "../domain/types";
import type {
  HistoricalEventRepository,
  HistoricalEvidenceRepository,
  HistoricalObservationRepository,
} from "../repositories/types";
import {
  CONTINUOUS_MOVE_CALIBRATION_V1,
  type ContinuousMoveCalibrationSeriesKey,
} from "./continuous-move-calibration";
import {
  detectContinuousMarketMove,
  type ContinuousMoveAssessmentStatus,
  type ContinuousMoveHorizonStatus,
} from "./continuous-move-detector";
import { buildMoveEvidenceBundle, type MoveEvidenceBundle } from "./move-evidence-bundle";
import {
  buildMaterialMoveConfirmation,
  type MaterialMoveConfirmationResult,
} from "./material-move-confirmation";

type MaterialMoveAsset = "BTC" | "GOLD";

export type MaterialMoveHorizonReadModel = {
  horizonMinutes: number;
  status: ContinuousMoveHorizonStatus;
  signedPercentChange: number | null;
  materialityThresholdPercent: number | null;
  targetPercentileRank: number | null;
  historicalSampleSize: number;
};

export type MaterialMoveMarketContext = {
  currentValue: number | null;
  valueUnit: string | null;
  changePercent: number | null;
  changeBasis: "ROLLING_24H" | "PREVIOUS_CLOSE" | "UNAVAILABLE";
};

export type MaterialMoveSynchronousFingerprintSeries = {
  seriesKey: string;
  sourceId: string;
  state: "AVAILABLE_SYNCHRONOUS" | "INSUFFICIENT_DATA" | "UNKNOWN";
  signedPercentChange: number | null;
};

export type MaterialMoveSynchronousFingerprintHorizon = {
  horizonMinutes: number;
  coverage: "COMPLETE" | "PARTIAL" | "EMPTY";
  series: MaterialMoveSynchronousFingerprintSeries[];
};

export type MaterialMoveEvidenceSummary = {
  evidenceCompleteness: "EVIDENCE_COMPLETE" | "EVIDENCE_INCOMPLETE";
  investigationWindow: {
    startAt: string;
    endAt: string;
  };
  synchronousCoverage: "COMPLETE" | "PARTIAL" | "EMPTY";
  synchronousFingerprint: MaterialMoveSynchronousFingerprintHorizon[];
  scheduledCatalystCount: number;
  scheduledCatalystCoverage:
    | "COMPLETE"
    | "BOUNDED_QUERY_LIMIT_REACHED"
    | "UNAVAILABLE";
  scheduledCatalysts: Array<Pick<
    MoveEvidenceBundle["scheduledCatalysts"]["events"][number],
    | "eventId"
    | "eventIdentityKey"
    | "subject"
    | "jurisdiction"
    | "importance"
    | "scheduledAt"
    | "retrievedAt"
    | "sourceId"
  >>;
  unscheduledCandidateCount: number;
  unscheduledCatalystCoverage:
    | "COMPLETE"
    | "PARTIAL"
    | "EMPTY"
    | "BOUNDED_QUERY_LIMIT_REACHED"
    | "UNAVAILABLE";
  unscheduledCandidates: Array<Pick<
    MoveEvidenceBundle["unscheduledCatalysts"]["candidates"][number],
    | "url"
    | "title"
    | "domain"
    | "providerDate"
    | "providerDateSemantics"
    | "temporalFit"
    | "firstSeenRetrievedAt"
    | "firstSnapshotEvidenceId"
  >>;
  slowBackground: {
    state: MoveEvidenceBundle["slowBackground"]["state"];
    items: Array<{
      kind: MoveEvidenceBundle["slowBackground"]["items"][number]["kind"];
      state: MoveEvidenceBundle["slowBackground"]["items"][number]["state"];
      reason: string | null;
    }>;
  };
  cryptoMarketStructure: {
    state: NonNullable<MoveEvidenceBundle["cryptoMarketStructure"]>["state"];
    components: Array<{
      component: NonNullable<
        MoveEvidenceBundle["cryptoMarketStructure"]
      >["components"][number]["component"];
      state: NonNullable<
        MoveEvidenceBundle["cryptoMarketStructure"]
      >["components"][number]["state"];
      reason: string;
    }>;
    reason: string;
  } | null;
  intradayRatesPricing: {
    state: MoveEvidenceBundle["intradayRatesPricing"]["state"];
    reason: string;
    policy: MoveEvidenceBundle["intradayRatesPricing"]["policy"];
  };
  confirmation?: MaterialMoveConfirmationResult | null;
  btcSpotFlow: {
    coverage:
      | "COMPLETE"
      | "PARTIAL"
      | "EMPTY"
      | "BOUNDED_QUERY_LIMIT_REACHED";
    venue: "BINANCE";
    pair: "BTCUSDT";
    windowMinutes: number | null;
    observedWindowCount: number;
    expectedWindowCount: number;
    totalBaseVolumeBtc: number;
    takerBuyBaseVolumeBtc: number;
    takerSellBaseVolumeBtc: number;
    netTakerBaseVolumeBtc: number;
    takerBuyShare: number | null;
    tradeCount: number;
  } | null;
};

export type MaterialMoveAssetReadModel = {
  asset: MaterialMoveAsset;
  seriesKey: ContinuousMoveCalibrationSeriesKey;
  sourceId: string;
  observedAt: string | null;
  marketContext: MaterialMoveMarketContext | null;
  status: ContinuousMoveAssessmentStatus | "UNAVAILABLE";
  hasMaterialMove: boolean;
  horizons: MaterialMoveHorizonReadModel[];
  evidence: MaterialMoveEvidenceSummary | null;
  causalAttribution: "NOT_EVALUATED";
  reason?: string;
};

export type MaterialMoveMonitorReadModel = {
  asOf: string;
  status: "OK" | "PARTIAL" | "UNAVAILABLE";
  assets: MaterialMoveAssetReadModel[];
  causalAttribution: "NOT_EVALUATED";
};

const MONITOR_SERIES: Array<{
  asset: MaterialMoveAsset;
  seriesKey: ContinuousMoveCalibrationSeriesKey;
  sourceId: string;
  domain: "ASSET";
}> = CONTINUOUS_MOVE_CALIBRATION_V1.series.map((item) => ({
  asset: item.seriesKey === "btc.spot.usd" ? "BTC" : "GOLD",
  seriesKey: item.seriesKey,
  sourceId: item.sourceId,
  domain: item.domain,
}));

async function latestTargetObservation(input: {
  repository: HistoricalObservationRepository;
  seriesKey: ContinuousMoveCalibrationSeriesKey;
  sourceId: string;
  domain: "ASSET";
  asOf: string;
}): Promise<Observation | null> {
  const rows = await input.repository.findHistory({
    identity: {
      domain: input.domain,
      seriesKey: input.seriesKey,
    },
    sourceId: input.sourceId,
    observedAtOnOrBefore: input.asOf,
    retrievedAtOnOrBefore: input.asOf,
    order: "DESC",
    limit: 1,
  });

  return rows[0] ?? null;
}

function compactHorizons(
  horizons: Awaited<ReturnType<typeof detectContinuousMarketMove>>["horizons"],
): MaterialMoveHorizonReadModel[] {
  return horizons.map((item) => ({
    horizonMinutes: Math.round(item.horizonMs / 60_000),
    status: item.status,
    signedPercentChange: item.signedPercentChange ?? null,
    materialityThresholdPercent: item.materialityThresholdPercent ?? null,
    targetPercentileRank: item.targetPercentileRank ?? null,
    historicalSampleSize: item.historicalSampleSize,
  }));
}

async function evidenceSummary(input: {
  assessment: Awaited<ReturnType<typeof detectContinuousMarketMove>>;
  observations: HistoricalObservationRepository;
  events: HistoricalEventRepository;
  evidence: HistoricalEvidenceRepository;
}): Promise<MaterialMoveEvidenceSummary | null> {
  if (!input.assessment.hasMaterialMove) return null;

  const result = await buildMoveEvidenceBundle({
    assessment: input.assessment,
    observations: input.observations,
    events: input.events,
    evidence: input.evidence,
  });
  if (result.status !== "READY") return null;

  const confirmation = result.bundle.targetAsset === "BTC"
    ? buildMaterialMoveConfirmation({ assessment: input.assessment, bundle: result.bundle })
    : null;
  const spotFlow = result.bundle.cryptoMarketStructure?.components
    .find((item) => item.component === "BTC_SPOT_FLOW")
    ?.spotFlow;
  const spotFlowTotals = spotFlow
    ? spotFlow.windows.reduce((totals, window) => ({
        totalBaseVolumeBtc: totals.totalBaseVolumeBtc + window.totalBaseVolumeBtc,
        takerBuyBaseVolumeBtc: totals.takerBuyBaseVolumeBtc + window.takerBuyBaseVolumeBtc,
        takerSellBaseVolumeBtc: totals.takerSellBaseVolumeBtc + window.takerSellBaseVolumeBtc,
        netTakerBaseVolumeBtc: totals.netTakerBaseVolumeBtc + window.netTakerBaseVolumeBtc,
        tradeCount: totals.tradeCount + window.tradeCount,
      }), {
        totalBaseVolumeBtc: 0,
        takerBuyBaseVolumeBtc: 0,
        takerSellBaseVolumeBtc: 0,
        netTakerBaseVolumeBtc: 0,
        tradeCount: 0,
      })
    : null;
  const spotFlowStart = spotFlow ? Date.parse(spotFlow.startAt) : Number.NaN;
  const spotFlowEnd = spotFlow ? Date.parse(spotFlow.endAt) : Number.NaN;
  const spotFlowWindowMinutes = Number.isFinite(spotFlowStart) && Number.isFinite(spotFlowEnd)
    ? Math.max(0, Math.round((spotFlowEnd - spotFlowStart) / 60_000))
    : null;

  return {
    evidenceCompleteness: result.bundle.evidenceCompleteness,
    confirmation,
    investigationWindow: {
      startAt: result.bundle.investigationWindow.startAt,
      endAt: result.bundle.investigationWindow.endAt,
    },
    synchronousCoverage: result.bundle.synchronousMarket.coverage,
    synchronousFingerprint: result.bundle.synchronousMarket.horizons.map((horizon) => ({
      horizonMinutes: Math.round(horizon.horizonMs / 60_000),
      coverage: horizon.coverage,
      series: horizon.series.map((series) => ({
        seriesKey: series.seriesKey,
        sourceId: series.sourceId,
        state: series.state,
        signedPercentChange: series.signedPercentChange ?? null,
      })),
    })),
    scheduledCatalystCount: result.bundle.scheduledCatalysts.events.length,
    scheduledCatalystCoverage: result.bundle.scheduledCatalysts.coverage,
    scheduledCatalysts: result.bundle.scheduledCatalysts.events.map((event) => ({
      eventId: event.eventId,
      eventIdentityKey: event.eventIdentityKey,
      subject: event.subject,
      jurisdiction: event.jurisdiction,
      importance: event.importance,
      scheduledAt: event.scheduledAt,
      retrievedAt: event.retrievedAt,
      sourceId: event.sourceId,
    })),
    unscheduledCandidateCount: result.bundle.unscheduledCatalysts.candidates.length,
    unscheduledCatalystCoverage: result.bundle.unscheduledCatalysts.coverage,
    unscheduledCandidates: result.bundle.unscheduledCatalysts.candidates.map((candidate) => ({
      url: candidate.url,
      title: candidate.title,
      domain: candidate.domain,
      providerDate: candidate.providerDate,
      providerDateSemantics: candidate.providerDateSemantics,
      temporalFit: candidate.temporalFit,
      firstSeenRetrievedAt: candidate.firstSeenRetrievedAt,
      firstSnapshotEvidenceId: candidate.firstSnapshotEvidenceId,
    })),
    slowBackground: {
      state: result.bundle.slowBackground.state,
      items: result.bundle.slowBackground.items.map((item) => ({
        kind: item.kind,
        state: item.state,
        reason: item.reason ?? null,
      })),
    },
    cryptoMarketStructure: result.bundle.cryptoMarketStructure
      ? {
          state: result.bundle.cryptoMarketStructure.state,
          components: result.bundle.cryptoMarketStructure.components.map((component) => ({
            component: component.component,
            state: component.state,
            reason: component.reason,
          })),
          reason: result.bundle.cryptoMarketStructure.reason,
        }
      : null,
    intradayRatesPricing: {
      state: result.bundle.intradayRatesPricing.state,
      reason: result.bundle.intradayRatesPricing.reason,
      policy: result.bundle.intradayRatesPricing.policy,
    },
    btcSpotFlow: spotFlow && spotFlowTotals
      ? {
          coverage: spotFlow.coverage,
          venue: spotFlow.venue,
          pair: spotFlow.pair,
          windowMinutes: spotFlowWindowMinutes,
          observedWindowCount: spotFlow.windows.length,
          expectedWindowCount: spotFlow.expectedCompletedWindows,
          ...spotFlowTotals,
          takerBuyShare: spotFlowTotals.totalBaseVolumeBtc > 0
            ? spotFlowTotals.takerBuyBaseVolumeBtc / spotFlowTotals.totalBaseVolumeBtc
            : null,
        }
      : null,
  };
}

function finiteMetadataNumber(
  observation: Observation,
  key: string,
): number | null {
  const value = observation.metadata?.[key];
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function materialMoveMarketContextFromObservation(
  observation: Observation,
): MaterialMoveMarketContext {
  const currentValue = Number(observation.value);
  const rawBasis = observation.metadata?.changeBasis;
  const changeBasis = rawBasis === "24h"
    ? "ROLLING_24H" as const
    : rawBasis === "previous_close"
      ? "PREVIOUS_CLOSE" as const
      : "UNAVAILABLE" as const;

  return {
    currentValue: Number.isFinite(currentValue) ? currentValue : null,
    valueUnit: typeof observation.metadata?.unit === "string"
      ? observation.metadata.unit
      : null,
    changePercent: finiteMetadataNumber(observation, "changePct"),
    changeBasis,
  };
}

async function buildAssetReadModel(input: {
  asset: MaterialMoveAsset;
  seriesKey: ContinuousMoveCalibrationSeriesKey;
  sourceId: string;
  domain: "ASSET";
  observations: HistoricalObservationRepository;
  events: HistoricalEventRepository;
  evidence: HistoricalEvidenceRepository;
  asOf: string;
}): Promise<MaterialMoveAssetReadModel> {
  try {
    const target = await latestTargetObservation({
      repository: input.observations,
      seriesKey: input.seriesKey,
      sourceId: input.sourceId,
      domain: input.domain,
      asOf: input.asOf,
    });

    if (!target) {
      return {
        asset: input.asset,
        seriesKey: input.seriesKey,
        sourceId: input.sourceId,
        observedAt: null,
        marketContext: null,
        status: "UNAVAILABLE",
        hasMaterialMove: false,
        horizons: [],
        evidence: null,
        causalAttribution: "NOT_EVALUATED",
        reason: "No durable target Observation is available at the dashboard cutoff.",
      };
    }

    const assessment = await detectContinuousMarketMove({
      repository: input.observations,
      seriesKey: input.seriesKey,
      targetEnd: target,
      asOf: input.asOf,
    });

    return {
      asset: input.asset,
      seriesKey: input.seriesKey,
      sourceId: input.sourceId,
      observedAt: assessment.targetEndObservedAt,
      marketContext: materialMoveMarketContextFromObservation(target),
      status: assessment.status,
      hasMaterialMove: assessment.hasMaterialMove,
      horizons: compactHorizons(assessment.horizons),
      evidence: await evidenceSummary({
        assessment,
        observations: input.observations,
        events: input.events,
        evidence: input.evidence,
      }),
      causalAttribution: "NOT_EVALUATED",
    };
  } catch (error) {
    return {
      asset: input.asset,
      seriesKey: input.seriesKey,
      sourceId: input.sourceId,
      observedAt: null,
      marketContext: null,
      status: "UNAVAILABLE",
      hasMaterialMove: false,
      horizons: [],
      evidence: null,
      causalAttribution: "NOT_EVALUATED",
      reason: error instanceof Error
        ? error.message
        : "Material MOVE monitor read failed.",
    };
  }
}

export async function buildMaterialMoveMonitor(input: {
  observations: HistoricalObservationRepository;
  events: HistoricalEventRepository;
  evidence: HistoricalEvidenceRepository;
  asOf: string;
}): Promise<MaterialMoveMonitorReadModel> {
  const assets = await Promise.all(MONITOR_SERIES.map((series) =>
    buildAssetReadModel({
      ...series,
      observations: input.observations,
      events: input.events,
      evidence: input.evidence,
      asOf: input.asOf,
    })));

  const unavailable = assets.filter((item) => item.status === "UNAVAILABLE").length;

  return {
    asOf: input.asOf,
    status: unavailable === assets.length
      ? "UNAVAILABLE"
      : unavailable > 0
        ? "PARTIAL"
        : "OK",
    assets,
    causalAttribution: "NOT_EVALUATED",
  };
}
