import type { EventWindowHistoricalSeriesRequest } from "./event-window-historical-context";

export const INTRADAY_HISTORICAL_CALIBRATION_V1 = {
  policy: "intraday-event-magnitude-historical-context-v1",
  version: "v1",
  lookbackMs: 36 * 60 * 60 * 1000,
  minimumSampleSize: 30,
  transformation: "ABSOLUTE_PERCENT_CHANGE",
  series: [
    {
      observationKey: "ASSET:btc.spot.usd:coingecko-market",
      seriesKey: "btc.spot.usd",
      sourceId: "coingecko-market",
    },
    {
      observationKey: "ASSET:dxy.index.usd:yahoo-finance",
      seriesKey: "dxy.index.usd",
      sourceId: "yahoo-finance",
    },
    {
      observationKey: "ASSET:gold.futures.usd:yahoo-finance",
      seriesKey: "gold.futures.usd",
      sourceId: "yahoo-finance",
    },
  ],
} as const;

export type IntradayHistoricalCalibrationSeries =
  typeof INTRADAY_HISTORICAL_CALIBRATION_V1.series[number];

export function buildIntradayHistoricalSeriesRequests(): EventWindowHistoricalSeriesRequest[] {
  const policy = INTRADAY_HISTORICAL_CALIBRATION_V1;
  return policy.series.map((series) => ({
    observationKey: series.observationKey,
    transformation: policy.transformation,
    lookbackMs: policy.lookbackMs,
    minimumSampleSize: policy.minimumSampleSize,
    methodologyId: policy.policy,
    methodologyVersion: policy.version,
  }));
}
