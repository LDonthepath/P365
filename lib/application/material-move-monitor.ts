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
import { buildMoveEvidenceBundle } from "./move-evidence-bundle";

type MaterialMoveAsset = "BTC" | "GOLD";

export type MaterialMoveHorizonReadModel = {
  horizonMinutes: number;
  status: ContinuousMoveHorizonStatus;
  signedPercentChange: number | null;
  materialityThresholdPercent: number | null;
  targetPercentileRank: number | null;
  historicalSampleSize: number;
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
  unscheduledCandidateCount: number;
  unscheduledCatalystCoverage:
    | "COMPLETE"
    | "PARTIAL"
    | "EMPTY"
    | "BOUNDED_QUERY_LIMIT_REACHED"
    | "UNAVAILABLE";
  btcSpotFlow: {
    coverage:
      | "COMPLETE"
      | "PARTIAL"
      | "EMPTY"
      | "BOUNDED_QUERY_LIMIT_REACHED";
    observedWindowCount: number;
    expectedWindowCount: number;
  } | null;
};

export type MaterialMoveAssetReadModel = {
  asset: MaterialMoveAsset;
  seriesKey: ContinuousMoveCalibrationSeriesKey;
  sourceId: string;
  observedAt: string | null;
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

  const spotFlow = result.bundle.cryptoMarketStructure?.components
    .find((item) => item.component === "BTC_SPOT_FLOW")
    ?.spotFlow;

  return {
    evidenceCompleteness: result.bundle.evidenceCompleteness,
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
    unscheduledCandidateCount: result.bundle.unscheduledCatalysts.candidates.length,
    unscheduledCatalystCoverage: result.bundle.unscheduledCatalysts.coverage,
    btcSpotFlow: spotFlow
      ? {
          coverage: spotFlow.coverage,
          observedWindowCount: spotFlow.windows.length,
          expectedWindowCount: spotFlow.expectedCompletedWindows,
        }
      : null,
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
