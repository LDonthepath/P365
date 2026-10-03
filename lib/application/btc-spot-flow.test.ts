import assert from "node:assert/strict";
import test from "node:test";
import type { BinanceSpotKline } from "../data/binance-spot-flow";
import type { BybitSpotTrade } from "../data/bybit-spot-flow";
import {
  buildBinanceBtcSpotFlowWindow,
  summarizeBybitRecentBtcSpotTrades,
} from "./btc-spot-flow";

test("Binance 5m venue flow derives sell volume, net flow and buy share in BTC", () => {
  const bar: BinanceSpotKline = {
    symbol: "BTCUSDT",
    providerIntervalStartMs: Date.parse("2026-10-04T12:00:00.000Z"),
    providerCloseTimeMs: Date.parse("2026-10-04T12:05:00.000Z") - 1,
    open: 100000,
    high: 101000,
    low: 99000,
    close: 100500,
    baseVolumeBtc: 10,
    quoteVolumeUsdt: 1005000,
    tradeCount: 200,
    takerBuyBaseVolumeBtc: 6,
    takerBuyQuoteVolumeUsdt: 603000,
  };

  const result = buildBinanceBtcSpotFlowWindow(bar);
  assert.equal(result.takerSellBaseVolumeBtc, 4);
  assert.equal(result.netTakerBaseVolumeBtc, 2);
  assert.equal(result.takerBuyShare, 0.6);
  assert.equal(result.observedAt, "2026-10-04T12:05:00.000Z");
  assert.equal(result.baseUnit, "BTC");
  assert.equal(result.coverage, "COMPLETE");
});

test("Bybit secondary evidence remains an explicit recent sample unless it spans five minutes", () => {
  const trades: BybitSpotTrade[] = [
    {
      execId: "1",
      symbol: "BTCUSDT",
      takerSide: "BUY",
      priceUsdt: 100000,
      baseSizeBtc: 0.2,
      executedAtMs: Date.parse("2026-10-04T12:00:00.000Z"),
      isBlockTrade: false,
      isRpiTrade: false,
      sequence: "1",
    },
    {
      execId: "2",
      symbol: "BTCUSDT",
      takerSide: "SELL",
      priceUsdt: 100100,
      baseSizeBtc: 0.1,
      executedAtMs: Date.parse("2026-10-04T12:01:00.000Z"),
      isBlockTrade: false,
      isRpiTrade: false,
      sequence: "2",
    },
  ];

  const result = summarizeBybitRecentBtcSpotTrades(trades);
  assert.equal(result.coverage, "RECENT_SAMPLE");
  assert.equal(result.coversFullFiveMinuteWindow, false);
  assert.ok(Math.abs(result.netTakerBaseVolumeBtc - 0.1) < 1e-12);
  assert.ok(Math.abs((result.takerBuyShare ?? 0) - (2 / 3)) < 1e-12);
});
