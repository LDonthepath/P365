import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateCoinalyzeLiquidationProviderFields,
  aggregateCoinalyzeOiWeightedFunding,
  aggregateCoinalyzeOpenInterestUsd,
} from "./coinalyze-derivatives-aggregation";

const T = 1_000;
const universe = ["BTC-A", "BTC-B"];

test("Coinalyze OI aggregate sums exact same-bucket USD closes and exposes coverage", () => {
  const result = aggregateCoinalyzeOpenInterestUsd({
    universeSymbols: universe,
    providerTimestamp: T,
    openInterest: [
      { symbol: "BTC-A", history: [{ providerTimestamp: T, open: 90, high: 110, low: 80, close: 100 }] },
      { symbol: "BTC-B", history: [{ providerTimestamp: T, open: 180, high: 220, low: 170, close: 200 }] },
    ],
  });
  assert.equal(result.totalOpenInterestUsd, 300);
  assert.equal(result.intervalEndTimestamp, T + 300);
  assert.equal(result.coverage, "COMPLETE");
  assert.deepEqual(result.missingSymbols, []);
  assert.equal(result.universeHash.length, 64);
});

test("Coinalyze OI aggregate retains partial coverage instead of turning missing venues into zero", () => {
  const result = aggregateCoinalyzeOpenInterestUsd({
    universeSymbols: universe,
    providerTimestamp: T,
    openInterest: [
      { symbol: "BTC-A", history: [{ providerTimestamp: T, open: 90, high: 110, low: 80, close: 100 }] },
    ],
  });
  assert.equal(result.totalOpenInterestUsd, 100);
  assert.equal(result.coverage, "PARTIAL");
  assert.deepEqual(result.missingSymbols, ["BTC-B"]);
});

test("Coinalyze funding aggregate is OI-weighted on exact provider bucket timestamps", () => {
  const result = aggregateCoinalyzeOiWeightedFunding({
    universeSymbols: universe,
    providerTimestamp: T,
    openInterest: [
      { symbol: "BTC-A", history: [{ providerTimestamp: T, open: 100, high: 100, low: 100, close: 100 }] },
      { symbol: "BTC-B", history: [{ providerTimestamp: T, open: 300, high: 300, low: 300, close: 300 }] },
    ],
    funding: [
      { symbol: "BTC-A", history: [{ providerTimestamp: T, open: 0.01, high: 0.01, low: 0.01, close: 0.01 }] },
      { symbol: "BTC-B", history: [{ providerTimestamp: T, open: 0.03, high: 0.03, low: 0.03, close: 0.03 }] },
    ],
  });
  assert.equal(result.oiWeightedFundingRatePercent, 0.025);
  assert.equal(result.totalWeightOpenInterestUsd, 400);
  assert.equal(result.coverage, "COMPLETE");
});

test("Coinalyze liquidation aggregation uses documented long/short semantics", () => {
  const result = aggregateCoinalyzeLiquidationProviderFields({
    universeSymbols: universe,
    providerTimestamp: T,
    liquidation: [
      { symbol: "BTC-A", history: [{ providerTimestamp: T, longLiquidationUsd: 10, shortLiquidationUsd: 20 }] },
      { symbol: "BTC-B", history: [{ providerTimestamp: T, longLiquidationUsd: 30, shortLiquidationUsd: 40 }] },
    ],
  });
  assert.equal(result.longLiquidationUsd, 40);
  assert.equal(result.shortLiquidationUsd, 60);
  assert.equal(result.coverage, "COMPLETE");
});
