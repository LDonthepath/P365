import assert from "node:assert/strict";
import test from "node:test";
import type { EventWindowHistoricalContext } from "../domain/event-window-historical-context";
import type { HistoricalBaselineEvidence } from "../domain/historical-baseline";
import { buildEventWindowRepricingCalibrationDataset } from "./repricing-threshold-calibration";

function evidence(seriesKey: string, sourceId: string, count: number): HistoricalBaselineEvidence {
  const samples = Array.from({ length: count }, (_, index) => ({
    observedAt: new Date(Date.parse("2026-10-01T00:00:00.000Z") + index * 600_000).toISOString(),
    startObservationId: `start-${seriesKey}-${index}`,
    endObservationId: `end-${seriesKey}-${index}`,
    value: (index + 1) / 100,
  }));
  return {
    id: `hist-${seriesKey}`,
    version: "v1",
    policy: "point-in-time-historical-baseline-v1",
    status: "VALID",
    methodology: {
      methodologyId: "intraday-event-magnitude-historical-context-v1",
      methodologyVersion: "v1",
      identity: { domain: "ASSET", seriesKey },
      sourceId,
      transformation: "ABSOLUTE_PERCENT_CHANGE",
      observedAtOnOrAfter: "2026-09-30T00:00:00.000Z",
      observedAtOnOrBefore: "2026-10-01T23:59:59.999Z",
      asOf: "2026-10-02T00:00:00.000Z",
      minimumSampleSize: 30,
      comparisonHorizonMs: 600_000,
    },
    targetObservationIds: [`before-${seriesKey}`, `after-${seriesKey}`],
    targetObservationQualities: ["FRESH", "FRESH"],
    targetValue: 0.3,
    sampleSize: count,
    samples,
    minimum: samples[0]?.value,
    maximum: samples.at(-1)?.value,
    median: 0.5,
    percentileRank: 50,
  };
}

test("RPR-002A dataset keeps eligible and insufficient series explicit without wiring RPR-001", () => {
  const context: EventWindowHistoricalContext = {
    id: "event-window-historical-context-v1-test",
    version: "v1",
    policy: "event-window-historical-move-context-v1",
    eventIdentityKey: "event:v1:US:test",
    windowId: "window-test",
    comparisonId: "comparison-test",
    afterRole: "T_PLUS_5",
    knowledgeAt: "2026-10-02T00:00:00.000Z",
    contaminationStatus: "CLEAN",
    contaminantEventIdentityKeys: [],
    requestedObservationKeys: [
      "ASSET:btc.spot.usd:coingecko-market",
      "ASSET:gold.futures.usd:yahoo-finance",
    ],
    missingObservationKeys: [],
    series: [
      {
        observationKey: "ASSET:btc.spot.usd:coingecko-market",
        seriesKey: "btc.spot.usd",
        sourceId: "coingecko-market",
        beforeObservationId: "before-btc.spot.usd",
        afterObservationId: "after-btc.spot.usd",
        comparisonHorizonMs: 600_000,
        historicalBaseline: evidence("btc.spot.usd", "coingecko-market", 120),
      },
      {
        observationKey: "ASSET:gold.futures.usd:yahoo-finance",
        seriesKey: "gold.futures.usd",
        sourceId: "yahoo-finance",
        beforeObservationId: "before-gold.futures.usd",
        afterObservationId: "after-gold.futures.usd",
        comparisonHorizonMs: 600_000,
        historicalBaseline: evidence("gold.futures.usd", "yahoo-finance", 40),
      },
    ],
    causalAttribution: "NOT_EVALUATED",
  };

  const dataset = buildEventWindowRepricingCalibrationDataset(context);

  assert.deepEqual(
    dataset.candidates.map((item) => [item.seriesKey, item.status]),
    [
      ["btc.spot.usd", "CANDIDATE"],
      ["gold.futures.usd", "INSUFFICIENT_DATA"],
    ],
  );
  assert.equal(dataset.causalAttribution, "NOT_EVALUATED");
});
