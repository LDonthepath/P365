import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { materialMoveMarketContextFromObservation } from "./material-move-monitor";

function observation(input: {
  id: string;
  value: string;
  changePct: number;
  changeBasis: string;
  sourceId: string;
  seriesKey: string;
}): Observation {
  return {
    id: input.id,
    domain: "ASSET",
    subject: input.seriesKey,
    value: input.value,
    observedAt: "2026-10-07T12:00:00.000Z",
    retrievedAt: "2026-10-07T12:01:00.000Z",
    sourceId: input.sourceId,
    quality: "FRESH",
    evidenceId: `evidence-${input.id}`,
    identity: {
      version: "v1",
      seriesKey: input.seriesKey,
      measurementId: `measurement-${input.id}`,
      revisionFingerprint: `revision-${input.id}`,
    },
    metadata: {
      metric: "price",
      unit: "USD",
      changePct: input.changePct,
      changeBasis: input.changeBasis,
    },
  };
}

test("normalizes BTC provider 24h change as rolling market context", () => {
  const context = materialMoveMarketContextFromObservation(observation({
    id: "btc",
    value: "84250",
    changePct: 3.1,
    changeBasis: "24h",
    sourceId: "coingecko-market",
    seriesKey: "btc.spot.usd",
  }));

  assert.deepEqual(context, {
    currentValue: 84250,
    valueUnit: "USD",
    changePercent: 3.1,
    changeBasis: "ROLLING_24H",
  });
});

test("normalizes Gold provider previous-close change without treating it as 24h", () => {
  const context = materialMoveMarketContextFromObservation(observation({
    id: "gold",
    value: "4149.4",
    changePct: -0.9,
    changeBasis: "previous_close",
    sourceId: "yahoo-finance",
    seriesKey: "gold.futures.usd",
  }));

  assert.deepEqual(context, {
    currentValue: 4149.4,
    valueUnit: "USD",
    changePercent: -0.9,
    changeBasis: "PREVIOUS_CLOSE",
  });
});
