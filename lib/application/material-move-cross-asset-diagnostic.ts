import type { HistoricalObservationRepository } from "../repositories/types";
import {
  CONTINUOUS_MOVE_CALIBRATION_V1,
  type ContinuousMoveCalibrationSeriesKey,
} from "./continuous-move-calibration";
import { detectContinuousMarketMove } from "./continuous-move-detector";
import {
  calibrateMaterialMoveCrossAssetRelationships,
  type MaterialMoveCrossAssetCalibration,
} from "./material-move-cross-asset-calibration";

export type MaterialMoveCrossAssetDiagnosticAsset = "BTC" | "GOLD";

export type MaterialMoveCrossAssetDiagnosticPair = {
  horizonMinutes: number;
  companionSeriesKey: string;
  status: MaterialMoveCrossAssetCalibration["pairs"][number]["status"];
  sourceHistoricalSampleSize: number;
  pairedSampleSize: number;
  unpairedSampleSize: number;
  pairedCoverageRatio: number | null;
  targetIntervalOverlapShare: number | null;
  sameDirectionShare: number | null;
  correlation: number | null;
};

export type MaterialMoveCrossAssetDiagnostic =
  | {
      status: "READY";
      asset: MaterialMoveCrossAssetDiagnosticAsset;
      seriesKey: ContinuousMoveCalibrationSeriesKey;
      asOf: string;
      moveAssessmentId: string;
      pairs: MaterialMoveCrossAssetDiagnosticPair[];
      statisticalSufficiency: "NOT_EVALUATED";
      sampleIndependence: "NOT_EVALUATED";
      directionalQualification: "NOT_EVALUATED";
      causalAttribution: "NOT_EVALUATED";
    }
  | {
      status: "NOT_TRIGGERED" | "UNAVAILABLE";
      asset: MaterialMoveCrossAssetDiagnosticAsset;
      seriesKey: ContinuousMoveCalibrationSeriesKey;
      asOf: string;
      reason: string;
    };

const SERIES = CONTINUOUS_MOVE_CALIBRATION_V1.series.map((item) => ({
  ...item,
  asset: item.seriesKey === "btc.spot.usd" ? "BTC" as const : "GOLD" as const,
}));

export function compactMaterialMoveCrossAssetCalibration(
  calibration: MaterialMoveCrossAssetCalibration,
): MaterialMoveCrossAssetDiagnosticPair[] {
  return calibration.pairs.map((pair) => ({
    horizonMinutes: Math.round(pair.horizonMs / 60_000),
    companionSeriesKey: pair.companionSeriesKey,
    status: pair.status,
    sourceHistoricalSampleSize: pair.sourceHistoricalSampleSize,
    pairedSampleSize: pair.pairedSampleSize,
    unpairedSampleSize: pair.unpairedSampleSize,
    pairedCoverageRatio: pair.pairedCoverageRatio,
    targetIntervalOverlapShare: pair.targetIntervalOverlapShare,
    sameDirectionShare: pair.sameDirectionShare,
    correlation: pair.correlation,
  }));
}

export async function buildMaterialMoveCrossAssetDiagnostic(input: {
  asset: MaterialMoveCrossAssetDiagnosticAsset;
  observations: HistoricalObservationRepository;
  asOf: string;
}): Promise<MaterialMoveCrossAssetDiagnostic> {
  const definition = SERIES.find((item) => item.asset === input.asset);
  if (!definition) {
    throw new Error("Unsupported material-move diagnostic asset.");
  }

  const latest = await input.observations.findHistory({
    identity: {
      domain: definition.domain,
      seriesKey: definition.seriesKey,
    },
    sourceId: definition.sourceId,
    observedAtOnOrBefore: input.asOf,
    retrievedAtOnOrBefore: input.asOf,
    order: "DESC",
    limit: 1,
  });

  const target = latest[0];
  if (!target) {
    return {
      status: "UNAVAILABLE",
      asset: input.asset,
      seriesKey: definition.seriesKey,
      asOf: input.asOf,
      reason: "No durable target Observation is available at the diagnostic cutoff.",
    };
  }

  const assessment = await detectContinuousMarketMove({
    repository: input.observations,
    seriesKey: definition.seriesKey,
    targetEnd: target,
    asOf: input.asOf,
  });

  if (!assessment.hasMaterialMove || assessment.status !== "MATERIAL_MOVE") {
    return {
      status: "NOT_TRIGGERED",
      asset: input.asset,
      seriesKey: definition.seriesKey,
      asOf: input.asOf,
      reason: "Current assessment is not a MATERIAL_MOVE; REL-002A remains dormant.",
    };
  }

  const result = await calibrateMaterialMoveCrossAssetRelationships({
    assessment,
    repository: input.observations,
  });

  if (result.status !== "READY") {
    return {
      status: "NOT_TRIGGERED",
      asset: input.asset,
      seriesKey: definition.seriesKey,
      asOf: input.asOf,
      reason: result.reason,
    };
  }

  return {
    status: "READY",
    asset: input.asset,
    seriesKey: definition.seriesKey,
    asOf: input.asOf,
    moveAssessmentId: result.calibration.moveAssessmentId,
    pairs: compactMaterialMoveCrossAssetCalibration(result.calibration),
    statisticalSufficiency: "NOT_EVALUATED",
    sampleIndependence: "NOT_EVALUATED",
    directionalQualification: "NOT_EVALUATED",
    causalAttribution: "NOT_EVALUATED",
  };
}
