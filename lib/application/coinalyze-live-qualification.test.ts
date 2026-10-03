import assert from "node:assert/strict";
import test from "node:test";
import type {
  CoinalyzeFutureMarket,
  CoinalyzeHistoryQuery,
  CoinalyzeHistorySeries,
  CoinalyzeLiquidationPoint,
  CoinalyzeOhlcPoint,
  CoinalyzeOhlcvPoint,
} from "../data/coinalyze-derivatives";
import { providerResult, type ProviderResult } from "../data/types";
import { runCoinalyzeLiveQualification } from "./coinalyze-live-qualification";

const NOW = new Date("2026-10-04T12:34:00.000Z");
const T1 = 1_780_552_800;
const T2 = T1 + 300;

function markets(): CoinalyzeFutureMarket[] {
  return [
    {
      symbol: "BTCUSDT_PERP.A",
      exchange: "A",
      symbolOnExchange: "BTCUSDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      isPerpetual: true,
      margined: "STABLE",
      expireAt: 0,
      denomination: "BASE_ASSET",
      hasLongShortRatioData: true,
      hasOhlcvData: true,
      hasBuySellData: true,
    },
    {
      symbol: "BTCUSD_PERP.B",
      exchange: "B",
      symbolOnExchange: "BTCUSD",
      baseAsset: "BTC",
      quoteAsset: "USD",
      isPerpetual: true,
      margined: "COIN",
      expireAt: 0,
      denomination: "QUOTE_ASSET",
      hasLongShortRatioData: true,
      hasOhlcvData: true,
      hasBuySellData: true,
    },
  ];
}

function ohlc(symbols: string[], closeBase: number): CoinalyzeHistorySeries<CoinalyzeOhlcPoint>[] {
  return symbols.map((symbol, index) => ({
    symbol,
    history: [
      { providerTimestamp: T1, open: closeBase, high: closeBase, low: closeBase, close: closeBase },
      { providerTimestamp: T2, open: closeBase + index, high: closeBase + index, low: closeBase + index, close: closeBase + index },
    ],
  }));
}

function liquidation(symbols: string[]): CoinalyzeHistorySeries<CoinalyzeLiquidationPoint>[] {
  return symbols.map((symbol, index) => ({
    symbol,
    history: [{ providerTimestamp: T2, longLiquidationUsd: 10 + index, shortLiquidationUsd: 20 + index }],
  }));
}

function ohlcv(symbols: string[]): CoinalyzeHistorySeries<CoinalyzeOhlcvPoint>[] {
  return symbols.map((symbol) => ({
    symbol,
    history: [{
      providerTimestamp: T2,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 10,
      buyVolume: 6,
      transactionCount: 5,
      buyTransactionCount: 3,
    }],
  }));
}

test("live qualification blocks cleanly without a configured API key", async () => {
  const report = await runCoinalyzeLiveQualification({
    now: () => NOW,
    provider: {
      futureMarkets: async () => providerResult("coinalyze", "UNAVAILABLE", [], "COINALYZE_API_KEY is not configured"),
      openInterest: async () => providerResult("coinalyze", "EMPTY"),
      funding: async () => providerResult("coinalyze", "EMPTY"),
      liquidation: async () => providerResult("coinalyze", "EMPTY"),
      ohlcv: async () => providerResult("coinalyze", "EMPTY"),
    },
  });
  assert.equal(report.status, "BLOCKED_NO_API_KEY");
  assert.equal(report.writesPerformed, false);
  assert.equal(report.universe, null);
});

test("live qualification reports deterministic sample, quota and unresolved semantics without writes", async () => {
  const symbols = markets().map((market) => market.symbol);
  let capturedQuery: CoinalyzeHistoryQuery | null = null;
  const report = await runCoinalyzeLiveQualification({
    now: () => NOW,
    provider: {
      futureMarkets: async () => providerResult("coinalyze", "SUCCESS", markets()),
      openInterest: async (query) => {
        capturedQuery = query;
        return providerResult("coinalyze", "SUCCESS", ohlc(query.symbols, 100));
      },
      funding: async (query) => providerResult("coinalyze", "SUCCESS", ohlc(query.symbols, 0.01)),
      liquidation: async (query) => providerResult("coinalyze", "SUCCESS", liquidation(query.symbols)),
      ohlcv: async (query) => providerResult("coinalyze", "SUCCESS", ohlcv(query.symbols)),
    },
  });

  assert.equal(report.status, "READY_FOR_SEMANTIC_REVIEW");
  assert.equal(report.writesPerformed, false);
  assert.equal(report.universe?.eligibleCount, 2);
  assert.deepEqual(report.universe?.sampleSymbols, symbols);
  assert.equal(report.universe?.symbolCallsPerFiveMinuteCycle, 8);
  assert.equal(report.universe?.completeCycleFitsSingleMinuteBurst, true);
  assert.equal(capturedQuery?.acquisitionMode, "FRESH");
  assert.equal(report.timestamps.length, 4);
  assert.equal(report.sampleAggregates?.openInterestCoverage, "COMPLETE");
  assert.equal(report.sampleAggregates?.fundingCoverage, "COMPLETE");
  assert.deepEqual(report.unresolved, ["DURABLE_PRIVATE_STORAGE_USE"]);
  assert.equal(report.semantics.providerTimestamp, "INTERVAL_START");
  assert.equal(report.semantics.liquidationL, "LONGS_LIQUIDATION_VOLUME");
});

test("live qualification fails closed when any sampled evidence family fails", async () => {
  const report = await runCoinalyzeLiveQualification({
    now: () => NOW,
    provider: {
      futureMarkets: async () => providerResult("coinalyze", "SUCCESS", markets()),
      openInterest: async (query) => providerResult("coinalyze", "SUCCESS", ohlc(query.symbols, 100)),
      funding: async () => providerResult("coinalyze", "ERROR", [], "Coinalyze HTTP 429"),
      liquidation: async (query) => providerResult("coinalyze", "SUCCESS", liquidation(query.symbols)),
      ohlcv: async (query) => providerResult("coinalyze", "SUCCESS", ohlcv(query.symbols)),
    },
  });
  assert.equal(report.status, "FAILED");
  assert.match(report.message ?? "", /funding=ERROR/);
  assert.equal(report.sampleAggregates, null);
});
