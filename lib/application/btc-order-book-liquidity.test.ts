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
  // Midpoint 100,050 USDT is the center of each band (not the best bid/ask).
  assert.equal(result.midUsdt, 100050);
  assert.equal(result.spreadUsdt, 100);
  assert.ok(Math.abs(result.spreadBps - (100 / 100050) * 10_000) < 1e-12);
  assert.equal(result.bands.length, 4);

  // 5 bps boundaries: bid >= 99,999.975; ask <= 100,100.025.
  const fiveBps = result.bands[0];
  assert.equal(fiveBps.bandBps, 5);
  assert.equal(fiveBps.bidDepthBtc, 1);
  assert.equal(fiveBps.askDepthBtc, 1.5);
  assert.equal(fiveBps.bidNotionalUsdt, 100000);
  assert.equal(fiveBps.askNotionalUsdt, 150150);
  assert.ok(Math.abs((fiveBps.quoteNotionalImbalance ?? NaN) - ((100000 - 150150) / (100000 + 150150))) < 1e-12);
  assert.equal(fiveBps.coverage, "COMPLETE");

  // 10 bps includes the next level on each side, with native USDT notionals.
  const tenBps = result.bands[1];
  assert.equal(tenBps.bandBps, 10);
  assert.equal(tenBps.bidDepthBtc, 3);
  assert.equal(tenBps.askDepthBtc, 4);
  assert.equal(tenBps.bidNotionalUsdt, 299900);
  assert.equal(tenBps.askNotionalUsdt, 400525);
  assert.ok(Math.abs((tenBps.quoteNotionalImbalance ?? NaN) - ((299900 - 400525) / (299900 + 400525))) < 1e-12);
  assert.equal(tenBps.coverage, "COMPLETE");
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
