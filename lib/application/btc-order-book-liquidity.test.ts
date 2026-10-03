import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBinanceBtcOrderBookLiquiditySnapshot,
} from "./btc-order-book-liquidity";

test("order-book liquidity derives spread and depth-band imbalance without USD conversion", () => {
  const result = buildBinanceBtcOrderBookLiquiditySnapshot({
    snapshot: {
      symbol: "BTCUSDT",
      lastUpdateId: 777,
      bids: [
        { priceUsdt: 100000, quantityBtc: 1 },
        { priceUsdt: 99950, quantityBtc: 2 },
        { priceUsdt: 99700, quantityBtc: 3 },
        { priceUsdt: 99400, quantityBtc: 4 },
      ],
      asks: [
        { priceUsdt: 100100, quantityBtc: 1.5 },
        { priceUsdt: 100150, quantityBtc: 2.5 },
        { priceUsdt: 100400, quantityBtc: 3.5 },
        { priceUsdt: 100700, quantityBtc: 4.5 },
      ],
    },
    retrievedAt: "2026-10-04T12:00:00.000Z",
  });

  assert.equal(result.snapshotTimeBasis, "P365_RETRIEVED_AT");
  assert.equal(result.providerLastUpdateId, 777);
  assert.equal(result.bestBidUsdt, 100000);
  assert.equal(result.bestAskUsdt, 100100);
  assert.ok(result.spreadBps > 0);
  assert.equal(result.bands.length, 4);
  assert.equal(result.bands[0].bandBps, 5);
  assert.equal(result.bands[0].bidDepthBtc, 3);
  assert.equal(result.bands[0].askDepthBtc, 4);
  assert.equal(result.bands[0].coverage, "COMPLETE");
});

test("order-book liquidity marks a band PARTIAL when returned levels do not reach both boundaries", () => {
  const result = buildBinanceBtcOrderBookLiquiditySnapshot({
    snapshot: {
      symbol: "BTCUSDT",
      lastUpdateId: 1,
      bids: [
        { priceUsdt: 100000, quantityBtc: 1 },
        { priceUsdt: 99990, quantityBtc: 1 },
      ],
      asks: [
        { priceUsdt: 100010, quantityBtc: 1 },
        { priceUsdt: 100020, quantityBtc: 1 },
      ],
    },
    retrievedAt: "2026-10-04T12:00:00.000Z",
  });

  assert.equal(result.bands.find((band) => band.bandBps === 50)?.coverage, "PARTIAL");
});

test("order-book liquidity uses quote-notional imbalance as USDT-native geometry, not USD", () => {
  const result = buildBinanceBtcOrderBookLiquiditySnapshot({
    snapshot: {
      symbol: "BTCUSDT",
      lastUpdateId: 2,
      bids: [
        { priceUsdt: 100000, quantityBtc: 2 },
        { priceUsdt: 99500, quantityBtc: 2 },
      ],
      asks: [
        { priceUsdt: 100100, quantityBtc: 1 },
        { priceUsdt: 100600, quantityBtc: 1 },
      ],
    },
    retrievedAt: "2026-10-04T12:00:00.000Z",
  });

  const band = result.bands.find((item) => item.bandBps === 50);
  assert.ok(band);
  assert.ok((band?.quoteNotionalImbalance ?? 0) > 0);
});
