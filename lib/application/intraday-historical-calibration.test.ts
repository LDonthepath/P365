import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIntradayHistoricalSeriesRequests,
  INTRADAY_HISTORICAL_CALIBRATION_V1,
} from "./intraday-historical-calibration";

test("HIST-001D freezes one explicit intraday magnitude policy for BTC DXY and Gold", () => {
  assert.equal(INTRADAY_HISTORICAL_CALIBRATION_V1.lookbackMs, 36 * 60 * 60 * 1000);
  assert.equal(INTRADAY_HISTORICAL_CALIBRATION_V1.minimumSampleSize, 30);
  assert.equal(
    INTRADAY_HISTORICAL_CALIBRATION_V1.transformation,
    "ABSOLUTE_PERCENT_CHANGE",
  );

  assert.deepEqual(
    INTRADAY_HISTORICAL_CALIBRATION_V1.series.map((series) => series.seriesKey),
    ["btc.spot.usd", "dxy.index.usd", "gold.futures.usd"],
  );
});

test("HIST-001D builds explicit HIST-001C requests without hidden defaults", () => {
  const requests = buildIntradayHistoricalSeriesRequests();
  assert.equal(requests.length, 3);
  assert.equal(new Set(requests.map((request) => request.observationKey)).size, 3);

  for (const request of requests) {
    assert.equal(request.transformation, "ABSOLUTE_PERCENT_CHANGE");
    assert.equal(request.lookbackMs, 36 * 60 * 60 * 1000);
    assert.equal(request.minimumSampleSize, 30);
    assert.equal(request.methodologyId, "intraday-event-magnitude-historical-context-v1");
    assert.equal(request.methodologyVersion, "v1");
  }

  assert.deepEqual(
    requests.map((request) => request.observationKey),
    [
      "ASSET:btc.spot.usd:coingecko-market",
      "ASSET:dxy.index.usd:yahoo-finance",
      "ASSET:gold.futures.usd:yahoo-finance",
    ],
  );
});
