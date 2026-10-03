const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * MOVE-001B calibration only.
 *
 * This policy does not run detection, persist MOVE records, infer causality,
 * or produce trading semantics. MOVE-001C is the first runtime consumer.
 */
export const CONTINUOUS_MOVE_CALIBRATION_V1 = {
  methodologyId: "continuous-market-move-materiality-v1",
  methodologyVersion: "v1",
  transformation: "ABSOLUTE_PERCENT_CHANGE",
  lookbackMs: 36 * HOUR_MS,
  minimumSampleSize: 120,
  materialityPercentile: 97.5,
  alignmentToleranceMs: 60 * 1000,
  horizonsMs: [
    15 * MINUTE_MS,
    30 * MINUTE_MS,
    60 * MINUTE_MS,
    120 * MINUTE_MS,
  ],
  series: [
    {
      domain: "ASSET",
      observationKey: "ASSET:btc.spot.usd:coingecko-market",
      seriesKey: "btc.spot.usd",
      sourceId: "coingecko-market",
    },
    {
      domain: "ASSET",
      observationKey: "ASSET:gold.futures.usd:yahoo-finance",
      seriesKey: "gold.futures.usd",
      sourceId: "yahoo-finance",
    },
  ],
} as const;

export type ContinuousMoveCalibrationSeries =
  typeof CONTINUOUS_MOVE_CALIBRATION_V1.series[number];

export type ContinuousMoveCalibrationSeriesKey =
  ContinuousMoveCalibrationSeries["seriesKey"];

export function continuousMoveCalibrationSeries(
  seriesKey: ContinuousMoveCalibrationSeriesKey,
): ContinuousMoveCalibrationSeries {
  const definition = CONTINUOUS_MOVE_CALIBRATION_V1.series.find(
    (series) => series.seriesKey === seriesKey,
  );
  if (!definition) {
    throw new Error(`Unsupported continuous MOVE series: ${seriesKey}`);
  }
  return definition;
}
