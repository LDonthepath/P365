import type { EventRepricingThreshold } from "./event-repricing";
import type { EventWindowRole } from "./event-window";
import {
  REPRICING_CALIBRATION_CANDIDATE_PERCENTILE_V1,
  REPRICING_THRESHOLD_CALIBRATION_POLICY_V1,
} from "./repricing-threshold-calibration";

export const PRODUCTION_REPRICING_THRESHOLD_POLICY_V1 =
  "empirical-p90-production-repricing-threshold-v1" as const;

export const PRODUCTION_REPRICING_THRESHOLD_AUDIT_DATE_V1 =
  "2026-10-02" as const;

export const PRODUCTION_REPRICING_THRESHOLD_LOOKBACK_MS_V1 =
  36 * 60 * 60 * 1000;

export type ProductionRepricingThresholdEntry = {
  observationKey: string;
  seriesKey: string;
  sourceId: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  comparisonHorizonMs: number;
  threshold: EventRepricingThreshold;
  calibration: {
    policy: typeof REPRICING_THRESHOLD_CALIBRATION_POLICY_V1;
    percentile: typeof REPRICING_CALIBRATION_CANDIDATE_PERCENTILE_V1;
    sampleSize: number;
    p90: number;
    auditDate: typeof PRODUCTION_REPRICING_THRESHOLD_AUDIT_DATE_V1;
    historicalLookbackMs: typeof PRODUCTION_REPRICING_THRESHOLD_LOOKBACK_MS_V1;
  };
};

export type ProductionRepricingUnavailableEntry = {
  observationKey: string;
  seriesKey: string;
  sourceId: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  comparisonHorizonMs: number;
  status: "INSUFFICIENT_DATA" | "NOT_CALIBRATED";
  reason: string;
};

const BTC_KEY = "ASSET:btc.spot.usd:coingecko-market";
const DXY_KEY = "ASSET:dxy.index.usd:yahoo-finance";
const GOLD_KEY = "ASSET:gold.futures.usd:yahoo-finance";

function thresholdEntry(input: {
  observationKey: string;
  seriesKey: string;
  sourceId: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  comparisonHorizonMs: number;
  sampleSize: number;
  p90: number;
}): ProductionRepricingThresholdEntry {
  return {
    observationKey: input.observationKey,
    seriesKey: input.seriesKey,
    sourceId: input.sourceId,
    afterRole: input.afterRole,
    comparisonHorizonMs: input.comparisonHorizonMs,
    threshold: {
      observationKey: input.observationKey,
      basis: "ABSOLUTE_PERCENT_CHANGE",
      minimumMagnitude: input.p90,
    },
    calibration: {
      policy: REPRICING_THRESHOLD_CALIBRATION_POLICY_V1,
      percentile: REPRICING_CALIBRATION_CANDIDATE_PERCENTILE_V1,
      sampleSize: input.sampleSize,
      p90: input.p90,
      auditDate: PRODUCTION_REPRICING_THRESHOLD_AUDIT_DATE_V1,
      historicalLookbackMs: PRODUCTION_REPRICING_THRESHOLD_LOOKBACK_MS_V1,
    },
  };
}

export const PRODUCTION_REPRICING_THRESHOLDS_V1: readonly ProductionRepricingThresholdEntry[] = [
  thresholdEntry({
    observationKey: BTC_KEY,
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    afterRole: "T_PLUS_5",
    comparisonHorizonMs: 10 * 60 * 1000,
    sampleSize: 111,
    p90: 0.226434,
  }),
  thresholdEntry({
    observationKey: BTC_KEY,
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    afterRole: "T_PLUS_15",
    comparisonHorizonMs: 20 * 60 * 1000,
    sampleSize: 121,
    p90: 0.277038,
  }),
  thresholdEntry({
    observationKey: BTC_KEY,
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    afterRole: "T_PLUS_30",
    comparisonHorizonMs: 35 * 60 * 1000,
    sampleSize: 110,
    p90: 0.436381,
  }),
  thresholdEntry({
    observationKey: BTC_KEY,
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    afterRole: "T_PLUS_60",
    comparisonHorizonMs: 65 * 60 * 1000,
    sampleSize: 122,
    p90: 0.860764,
  }),
  thresholdEntry({
    observationKey: DXY_KEY,
    seriesKey: "dxy.index.usd",
    sourceId: "yahoo-finance",
    afterRole: "T_PLUS_5",
    comparisonHorizonMs: 10 * 60 * 1000,
    sampleSize: 133,
    p90: 0.071222,
  }),
  thresholdEntry({
    observationKey: DXY_KEY,
    seriesKey: "dxy.index.usd",
    sourceId: "yahoo-finance",
    afterRole: "T_PLUS_15",
    comparisonHorizonMs: 20 * 60 * 1000,
    sampleSize: 101,
    p90: 0.096451,
  }),
  thresholdEntry({
    observationKey: DXY_KEY,
    seriesKey: "dxy.index.usd",
    sourceId: "yahoo-finance",
    afterRole: "T_PLUS_30",
    comparisonHorizonMs: 35 * 60 * 1000,
    sampleSize: 106,
    p90: 0.137335,
  }),
  thresholdEntry({
    observationKey: DXY_KEY,
    seriesKey: "dxy.index.usd",
    sourceId: "yahoo-finance",
    afterRole: "T_PLUS_60",
    comparisonHorizonMs: 65 * 60 * 1000,
    sampleSize: 128,
    p90: 0.134415,
  }),
] as const;

export const PRODUCTION_REPRICING_UNAVAILABLE_V1: readonly ProductionRepricingUnavailableEntry[] = [
  {
    observationKey: GOLD_KEY,
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    afterRole: "T_PLUS_5",
    comparisonHorizonMs: 10 * 60 * 1000,
    status: "INSUFFICIENT_DATA",
    reason: "RPR-002A audit produced 35 exact-horizon samples; at least 100 are required.",
  },
  {
    observationKey: GOLD_KEY,
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    afterRole: "T_PLUS_15",
    comparisonHorizonMs: 20 * 60 * 1000,
    status: "INSUFFICIENT_DATA",
    reason: "RPR-002A audit produced 31 exact-horizon samples; at least 100 are required.",
  },
  {
    observationKey: GOLD_KEY,
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    afterRole: "T_PLUS_30",
    comparisonHorizonMs: 35 * 60 * 1000,
    status: "INSUFFICIENT_DATA",
    reason: "RPR-002A audit produced 33 exact-horizon samples; at least 100 are required.",
  },
  {
    observationKey: GOLD_KEY,
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    afterRole: "T_PLUS_60",
    comparisonHorizonMs: 65 * 60 * 1000,
    status: "INSUFFICIENT_DATA",
    reason: "RPR-002A audit produced 43 exact-horizon samples; at least 100 are required.",
  },
] as const;

/**
 * Returns only a frozen, calibration-backed threshold with exact
 * observation-key + post-role + horizon lineage.
 *
 * RPR-002B deliberately has no nearest-horizon fallback and no default.
 */
export function productionRepricingThresholdFor(input: {
  observationKey: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  comparisonHorizonMs: number;
}): EventRepricingThreshold | null {
  const entry = PRODUCTION_REPRICING_THRESHOLDS_V1.find(
    (item) =>
      item.observationKey === input.observationKey
      && item.afterRole === input.afterRole
      && item.comparisonHorizonMs === input.comparisonHorizonMs,
  );

  return entry ? { ...entry.threshold } : null;
}
