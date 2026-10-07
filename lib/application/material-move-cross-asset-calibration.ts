import { createHash } from "node:crypto";
import { historicalObservationFitnessEligible } from "../domain/historical-observation-fitness";
import { historicalRelationshipPearson } from "../domain/historical-relationship";
import type { Observation, ObservationDomain } from "../domain/types";
import { observationSemanticSeriesKey } from "../repositories/observation-history";
import type { HistoricalObservationRepository } from "../repositories/types";
import { CONTINUOUS_MOVE_CALIBRATION_V1 } from "./continuous-move-calibration";
import type {
  ContinuousMoveAssessment,
  ContinuousMoveHistoricalSample,
  ContinuousMoveHorizonAssessment,
} from "./continuous-move-detector";

const MINUTE_MS = 60 * 1000;
const CROSS_ASSET_ALIGNMENT_TOLERANCE_MS = 2 * MINUTE_MS;
const HISTORY_QUERY_LIMIT = 500;

export const MATERIAL_MOVE_CROSS_ASSET_CALIBRATION_POLICY =
  "material-move-cross-asset-relationship-calibration-v1" as const;

type SeriesDefinition = {
  domain: ObservationDomain;
  seriesKey: string;
  sourceId: string;
};

const SERIES = {
  BTC: { domain: "ASSET", seriesKey: "btc.spot.usd", sourceId: "coingecko-market" },
  ETH: { domain: "ASSET", seriesKey: "eth.spot.usd", sourceId: "coingecko-market" },
  DXY: { domain: "ASSET", seriesKey: "dxy.index.usd", sourceId: "yahoo-finance" },
  GOLD: { domain: "ASSET", seriesKey: "gold.futures.usd", sourceId: "yahoo-finance" },
  USDJPY: { domain: "ASSET", seriesKey: "fx.usdjpy.jpy_per_usd", sourceId: "yahoo-finance" },
  USDCNH: { domain: "ASSET", seriesKey: "fx.usdcnh.cnh_per_usd", sourceId: "yahoo-finance" },
} as const satisfies Record<string, SeriesDefinition>;

const COMPANIONS = {
  "btc.spot.usd": [SERIES.ETH, SERIES.DXY, SERIES.GOLD, SERIES.USDJPY, SERIES.USDCNH],
  "gold.futures.usd": [SERIES.DXY, SERIES.BTC, SERIES.USDJPY, SERIES.USDCNH],
} as const satisfies Record<ContinuousMoveAssessment["seriesKey"], readonly SeriesDefinition[]>;

export type MaterialMoveCrossAssetAlignment =
  | "SAME_DIRECTION"
  | "OPPOSITE_DIRECTION"
  | "FLAT";

export type MaterialMoveCrossAssetCalibrationSample = {
  targetStartObservationId: string;
  targetEndObservationId: string;
  companionStartObservationId: string;
  companionEndObservationId: string;
  targetStartObservedAt: string;
  targetEndObservedAt: string;
  companionStartObservedAt: string;
  companionEndObservedAt: string;
  targetSignedPercentChange: number;
  companionSignedPercentChange: number;
  alignment: MaterialMoveCrossAssetAlignment;
};

export type MaterialMoveCrossAssetCalibrationPair = {
  targetSeriesKey: ContinuousMoveAssessment["seriesKey"];
  companionSeriesKey: string;
  horizonMs: number;
  status: "MEASURED" | "INSUFFICIENT_DATA" | "UNKNOWN";
  minimumSampleSize: typeof CONTINUOUS_MOVE_CALIBRATION_V1.minimumSampleSize;
  sourceHistoricalSampleSize: number;
  pairedSampleSize: number;
  sameDirectionCount: number;
  oppositeDirectionCount: number;
  flatCount: number;
  sameDirectionShare: number | null;
  correlation: number | null;
  alignmentToleranceMs: typeof CROSS_ASSET_ALIGNMENT_TOLERANCE_MS;
  samples: MaterialMoveCrossAssetCalibrationSample[];
  reason: string | null;
  causalAttribution: "NOT_EVALUATED";
};

export type MaterialMoveCrossAssetCalibration = {
  id: string;
  version: "v1";
  policy: typeof MATERIAL_MOVE_CROSS_ASSET_CALIBRATION_POLICY;
  moveAssessmentId: string;
  targetSeriesKey: ContinuousMoveAssessment["seriesKey"];
  asOf: string;
  methodology: {
    transformation: "SIGNED_PERCENT_CHANGE";
    historicalWindowMs: typeof CONTINUOUS_MOVE_CALIBRATION_V1.lookbackMs;
    minimumSampleSize: typeof CONTINUOUS_MOVE_CALIBRATION_V1.minimumSampleSize;
    alignmentToleranceMs: typeof CROSS_ASSET_ALIGNMENT_TOLERANCE_MS;
    relationshipThreshold: "NOT_DEFINED";
  };
  pairs: MaterialMoveCrossAssetCalibrationPair[];
  causalAttribution: "NOT_EVALUATED";
  directionalQualification: "NOT_EVALUATED";
  writesPerformed: false;
};

export type MaterialMoveCrossAssetCalibrationResult =
  | { status: "READY"; calibration: MaterialMoveCrossAssetCalibration }
  | { status: "NOT_TRIGGERED"; reason: string };

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function timestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numeric(observation: Observation): number | undefined {
  const parsed = Number(observation.value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function percentChange(start: number, end: number): number | undefined {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) return undefined;
  return ((end - start) / start) * 100;
}

function alignment(left: number, right: number): MaterialMoveCrossAssetAlignment {
  if (left === 0 || right === 0) return "FLAT";
  return Math.sign(left) === Math.sign(right)
    ? "SAME_DIRECTION"
    : "OPPOSITE_DIRECTION";
}

function seriesKey(observation: Observation): string | undefined {
  return observation.identity?.seriesKey
    ?? observationSemanticSeriesKey(observation)
    ?? undefined;
}

function eligibleObservation(
  observation: Observation,
  definition: SeriesDefinition,
): boolean {
  return observation.domain === definition.domain
    && observation.sourceId === definition.sourceId
    && seriesKey(observation) === definition.seriesKey
    && historicalObservationFitnessEligible(observation)
    && numeric(observation) !== undefined;
}

function latestByObservedAt(observations: Observation[]): Observation[] {
  const latest = new Map<number, Observation>();
  for (const observation of observations) {
    const observedAt = timestamp(observation.observedAt);
    if (observedAt === undefined) continue;
    const existing = latest.get(observedAt);
    if (
      !existing
      || observation.retrievedAt > existing.retrievedAt
      || (
        observation.retrievedAt === existing.retrievedAt
        && observation.id > existing.id
      )
    ) {
      latest.set(observedAt, observation);
    }
  }
  return [...latest.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

function nearestObservation(
  observations: Observation[],
  desiredAt: string,
): Observation | undefined {
  const desired = timestamp(desiredAt);
  if (desired === undefined) return undefined;

  let selected:
    | { observation: Observation; observedAt: number; errorMs: number }
    | undefined;

  for (const observation of observations) {
    const observedAt = timestamp(observation.observedAt);
    if (observedAt === undefined) continue;
    const errorMs = Math.abs(observedAt - desired);
    if (errorMs > CROSS_ASSET_ALIGNMENT_TOLERANCE_MS) continue;
    if (
      !selected
      || errorMs < selected.errorMs
      || (errorMs === selected.errorMs && observedAt > selected.observedAt)
      || (
        errorMs === selected.errorMs
        && observedAt === selected.observedAt
        && observation.id > selected.observation.id
      )
    ) {
      selected = { observation, observedAt, errorMs };
    }
  }

  return selected?.observation;
}

function materialHorizons(
  assessment: ContinuousMoveAssessment,
): ContinuousMoveHorizonAssessment[] {
  return assessment.horizons.filter(
    (horizon) => horizon.status === "MATERIAL_MOVE",
  );
}

function historyBounds(
  horizon: ContinuousMoveHorizonAssessment,
): { from: string; through: string } | undefined {
  if (!horizon.historicalSamples.length) return undefined;
  const endTimes = horizon.historicalSamples
    .map((sample) => timestamp(sample.endObservedAt))
    .filter((value): value is number => value !== undefined);
  if (!endTimes.length) return undefined;

  const from = Math.min(...endTimes)
    - horizon.horizonMs
    - CONTINUOUS_MOVE_CALIBRATION_V1.alignmentToleranceMs
    - CROSS_ASSET_ALIGNMENT_TOLERANCE_MS;
  const through = Math.max(...endTimes) + CROSS_ASSET_ALIGNMENT_TOLERANCE_MS;

  return {
    from: new Date(from).toISOString(),
    through: new Date(through).toISOString(),
  };
}

async function queryHistory(input: {
  repository: HistoricalObservationRepository;
  definition: SeriesDefinition;
  from: string;
  through: string;
  asOf: string;
}): Promise<
  | { status: "READY"; observations: Observation[] }
  | { status: "UNKNOWN"; reason: string }
> {
  try {
    const rows = await input.repository.findHistory({
      identity: {
        domain: input.definition.domain,
        seriesKey: input.definition.seriesKey,
      },
      sourceId: input.definition.sourceId,
      observedAtOnOrAfter: input.from,
      observedAtOnOrBefore: input.through,
      retrievedAtOnOrBefore: input.asOf,
      order: "ASC",
      limit: HISTORY_QUERY_LIMIT,
    });

    if (rows.length >= HISTORY_QUERY_LIMIT) {
      return {
        status: "UNKNOWN",
        reason:
          "Bounded historical query reached the 500-row limit; complete calibration coverage is not proven.",
      };
    }

    return {
      status: "READY",
      observations: latestByObservedAt(
        rows.filter((row) => eligibleObservation(row, input.definition)),
      ),
    };
  } catch {
    return {
      status: "UNKNOWN",
      reason: "Historical Observation repository read failed.",
    };
  }
}

function buildSamples(input: {
  historicalSamples: ContinuousMoveHistoricalSample[];
  target: Observation[];
  companion: Observation[];
}): MaterialMoveCrossAssetCalibrationSample[] {
  const targetById = new Map(input.target.map((observation) => [observation.id, observation]));
  const samples: MaterialMoveCrossAssetCalibrationSample[] = [];

  for (const historical of input.historicalSamples) {
    const targetStart = targetById.get(historical.startObservationId);
    const targetEnd = targetById.get(historical.endObservationId);
    if (!targetStart || !targetEnd) continue;

    const targetStartValue = numeric(targetStart);
    const targetEndValue = numeric(targetEnd);
    if (targetStartValue === undefined || targetEndValue === undefined) continue;

    const companionStart = nearestObservation(input.companion, targetStart.observedAt);
    const companionEnd = nearestObservation(input.companion, targetEnd.observedAt);
    if (!companionStart || !companionEnd || companionStart.id === companionEnd.id) continue;

    const companionStartValue = numeric(companionStart);
    const companionEndValue = numeric(companionEnd);
    if (companionStartValue === undefined || companionEndValue === undefined) continue;

    const targetSignedPercentChange = percentChange(targetStartValue, targetEndValue);
    const companionSignedPercentChange = percentChange(
      companionStartValue,
      companionEndValue,
    );
    if (
      targetSignedPercentChange === undefined
      || companionSignedPercentChange === undefined
    ) {
      continue;
    }

    samples.push({
      targetStartObservationId: targetStart.id,
      targetEndObservationId: targetEnd.id,
      companionStartObservationId: companionStart.id,
      companionEndObservationId: companionEnd.id,
      targetStartObservedAt: targetStart.observedAt,
      targetEndObservedAt: targetEnd.observedAt,
      companionStartObservedAt: companionStart.observedAt,
      companionEndObservedAt: companionEnd.observedAt,
      targetSignedPercentChange,
      companionSignedPercentChange,
      alignment: alignment(
        targetSignedPercentChange,
        companionSignedPercentChange,
      ),
    });
  }

  return samples.sort((a, b) =>
    a.targetEndObservedAt.localeCompare(b.targetEndObservedAt)
    || a.targetEndObservationId.localeCompare(b.targetEndObservationId)
    || a.companionEndObservationId.localeCompare(b.companionEndObservationId));
}

function measuredPair(input: {
  assessment: ContinuousMoveAssessment;
  horizon: ContinuousMoveHorizonAssessment;
  companion: SeriesDefinition;
  samples: MaterialMoveCrossAssetCalibrationSample[];
}): MaterialMoveCrossAssetCalibrationPair {
  const directional = input.samples.filter((sample) => sample.alignment !== "FLAT");
  const sameDirectionCount = input.samples.filter(
    (sample) => sample.alignment === "SAME_DIRECTION",
  ).length;
  const oppositeDirectionCount = input.samples.filter(
    (sample) => sample.alignment === "OPPOSITE_DIRECTION",
  ).length;
  const flatCount = input.samples.length - sameDirectionCount - oppositeDirectionCount;
  const correlation = historicalRelationshipPearson(
    input.samples.map((sample) => ({
      leftValue: sample.targetSignedPercentChange,
      rightValue: sample.companionSignedPercentChange,
    })),
  );
  const enoughSamples =
    input.samples.length >= CONTINUOUS_MOVE_CALIBRATION_V1.minimumSampleSize;
  const status = enoughSamples && correlation !== undefined
    ? "MEASURED" as const
    : "INSUFFICIENT_DATA" as const;

  return {
    targetSeriesKey: input.assessment.seriesKey,
    companionSeriesKey: input.companion.seriesKey,
    horizonMs: input.horizon.horizonMs,
    status,
    minimumSampleSize: CONTINUOUS_MOVE_CALIBRATION_V1.minimumSampleSize,
    sourceHistoricalSampleSize: input.horizon.historicalSamples.length,
    pairedSampleSize: input.samples.length,
    sameDirectionCount,
    oppositeDirectionCount,
    flatCount,
    sameDirectionShare: directional.length
      ? sameDirectionCount / directional.length
      : null,
    correlation: correlation ?? null,
    alignmentToleranceMs: CROSS_ASSET_ALIGNMENT_TOLERANCE_MS,
    samples: input.samples,
    reason: status === "MEASURED"
      ? null
      : enoughSamples
        ? "Paired signed changes do not have enough non-zero variance for Pearson correlation."
        : "Paired cross-asset samples are below the existing MOVE-001B minimumSampleSize.",
    causalAttribution: "NOT_EVALUATED",
  };
}

async function calibratePair(input: {
  assessment: ContinuousMoveAssessment;
  horizon: ContinuousMoveHorizonAssessment;
  target: SeriesDefinition;
  companion: SeriesDefinition;
  repository: HistoricalObservationRepository;
}): Promise<MaterialMoveCrossAssetCalibrationPair> {
  const base = {
    targetSeriesKey: input.assessment.seriesKey,
    companionSeriesKey: input.companion.seriesKey,
    horizonMs: input.horizon.horizonMs,
    minimumSampleSize: CONTINUOUS_MOVE_CALIBRATION_V1.minimumSampleSize,
    sourceHistoricalSampleSize: input.horizon.historicalSamples.length,
    alignmentToleranceMs: CROSS_ASSET_ALIGNMENT_TOLERANCE_MS,
    causalAttribution: "NOT_EVALUATED" as const,
  };

  if (
    input.horizon.historicalSamples.length
    < CONTINUOUS_MOVE_CALIBRATION_V1.minimumSampleSize
  ) {
    return {
      ...base,
      status: "INSUFFICIENT_DATA",
      pairedSampleSize: 0,
      sameDirectionCount: 0,
      oppositeDirectionCount: 0,
      flatCount: 0,
      sameDirectionShare: null,
      correlation: null,
      samples: [],
      reason:
        "Source MOVE horizon itself is below the existing MOVE-001B minimumSampleSize.",
    };
  }

  const bounds = historyBounds(input.horizon);
  if (!bounds) {
    return {
      ...base,
      status: "UNKNOWN",
      pairedSampleSize: 0,
      sameDirectionCount: 0,
      oppositeDirectionCount: 0,
      flatCount: 0,
      sameDirectionShare: null,
      correlation: null,
      samples: [],
      reason: "Historical MOVE sample timestamps are invalid.",
    };
  }

  const [targetHistory, companionHistory] = await Promise.all([
    queryHistory({
      repository: input.repository,
      definition: input.target,
      from: bounds.from,
      through: bounds.through,
      asOf: input.assessment.asOf,
    }),
    queryHistory({
      repository: input.repository,
      definition: input.companion,
      from: bounds.from,
      through: bounds.through,
      asOf: input.assessment.asOf,
    }),
  ]);

  if (targetHistory.status === "UNKNOWN" || companionHistory.status === "UNKNOWN") {
    return {
      ...base,
      status: "UNKNOWN",
      pairedSampleSize: 0,
      sameDirectionCount: 0,
      oppositeDirectionCount: 0,
      flatCount: 0,
      sameDirectionShare: null,
      correlation: null,
      samples: [],
      reason: [
        targetHistory.status === "UNKNOWN" ? targetHistory.reason : null,
        companionHistory.status === "UNKNOWN" ? companionHistory.reason : null,
      ].filter(Boolean).join(" "),
    };
  }

  return measuredPair({
    assessment: input.assessment,
    horizon: input.horizon,
    companion: input.companion,
    samples: buildSamples({
      historicalSamples: input.horizon.historicalSamples,
      target: targetHistory.observations,
      companion: companionHistory.observations,
    }),
  });
}

/**
 * REL-002A calibrates synchronous cross-asset relationship evidence for the
 * horizons that already triggered a BTC/Gold MATERIAL_MOVE.
 *
 * It intentionally stops at measurement. Correlation and directional-share
 * statistics are not converted into SUPPORTING / CONTRADICTING evidence here.
 */
export async function calibrateMaterialMoveCrossAssetRelationships(input: {
  assessment: ContinuousMoveAssessment;
  repository: HistoricalObservationRepository;
}): Promise<MaterialMoveCrossAssetCalibrationResult> {
  if (
    input.assessment.status !== "MATERIAL_MOVE"
    || !input.assessment.hasMaterialMove
  ) {
    return {
      status: "NOT_TRIGGERED",
      reason: "REL-002A requires an existing BTC/Gold MATERIAL_MOVE assessment.",
    };
  }

  const horizons = materialHorizons(input.assessment);
  if (!horizons.length) {
    return {
      status: "NOT_TRIGGERED",
      reason: "REL-002A requires at least one MATERIAL_MOVE horizon.",
    };
  }

  const target = input.assessment.seriesKey === "btc.spot.usd"
    ? SERIES.BTC
    : SERIES.GOLD;
  const companions = COMPANIONS[input.assessment.seriesKey];

  const pairs = (
    await Promise.all(
      horizons.flatMap((horizon) =>
        companions.map((companion) =>
          calibratePair({
            assessment: input.assessment,
            horizon,
            target,
            companion,
            repository: input.repository,
          }),
        ),
      ),
    )
  ).sort((a, b) =>
    a.horizonMs - b.horizonMs
    || a.companionSeriesKey.localeCompare(b.companionSeriesKey));

  const withoutId = {
    version: "v1" as const,
    policy: MATERIAL_MOVE_CROSS_ASSET_CALIBRATION_POLICY,
    moveAssessmentId: input.assessment.id,
    targetSeriesKey: input.assessment.seriesKey,
    asOf: input.assessment.asOf,
    methodology: {
      transformation: "SIGNED_PERCENT_CHANGE" as const,
      historicalWindowMs: CONTINUOUS_MOVE_CALIBRATION_V1.lookbackMs,
      minimumSampleSize: CONTINUOUS_MOVE_CALIBRATION_V1.minimumSampleSize,
      alignmentToleranceMs: CROSS_ASSET_ALIGNMENT_TOLERANCE_MS,
      relationshipThreshold: "NOT_DEFINED" as const,
    },
    pairs,
    causalAttribution: "NOT_EVALUATED" as const,
    directionalQualification: "NOT_EVALUATED" as const,
    writesPerformed: false as const,
  };

  return {
    status: "READY",
    calibration: {
      id: "material-move-cross-asset-calibration-v1-" + hash(withoutId),
      ...withoutId,
    },
  };
}
