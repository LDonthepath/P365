import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBinanceFuturesBtcPerpLiquiditySnapshot,
  buildHyperliquidBtcPerpLiquiditySnapshot,
} from "./btc-perp-order-book-liquidity";

test("Hyperliquid and Binance Futures share BTC-base depth geometry but retain venue lineage", () => {
  const hyper = buildHyperliquidBtcPerpLiquiditySnapshot({
    snapshot: {
      coin: "BTC",
      providerTimeMs: Date.parse("2026-10-04T00:00:00.000Z"),
      bids: [
        { price: 85000, quantityBtc: 2, restingOrderCount: 4 },
        { price: 84950, quantityBtc: 3, restingOrderCount: 5 },
      ],
      asks: [
        { price: 85010, quantityBtc: 1, restingOrderCount: 2 },
        { price: 85060, quantityBtc: 2, restingOrderCount: 3 },
      ],
    },
    retrievedAt: "2026-10-04T00:00:01.000Z",
  });

  const binance = buildBinanceFuturesBtcPerpLiquiditySnapshot({
    snapshot: {
      symbol: "BTCUSDT",
      lastUpdateId: 88,
      messageOutputTimeMs: Date.parse("2026-10-04T00:00:00.100Z"),
      transactionTimeMs: Date.parse("2026-10-04T00:00:00.090Z"),
      bids: [
        { priceUsdt: 85000, quantityBtc: 2 },
        { priceUsdt: 84950, quantityBtc: 3 },
      ],
      asks: [
        { priceUsdt: 85010, quantityBtc: 1 },
        { priceUsdt: 85060, quantityBtc: 2 },
      ],
    },
    retrievedAt: "2026-10-04T00:00:01.000Z",
  });

  assert.equal(hyper.marketType, "PERPETUAL");
  assert.equal(binance.marketType, "PERPETUAL");
  assert.equal(hyper.venue, "HYPERLIQUID");
  assert.equal(binance.venue, "BINANCE_FUTURES");
  assert.equal(hyper.providerTimestampKind, "BOOK_SNAPSHOT_TIME");
  assert.equal(binance.providerTimestampKind, "TRANSACTION_TIME");
  assert.equal(binance.providerSequence, 88);
  assert.equal(hyper.bands[0].bidRestingOrderCount, 4);
  assert.equal(binance.bands[0].bidRestingOrderCount, null);
  assert.equal(hyper.methodology, binance.methodology);
});

test("20-level style shallow snapshots stay PARTIAL when they do not span a band", () => {
  const result = buildHyperliquidBtcPerpLiquiditySnapshot({
    snapshot: {
      coin: "BTC",
      providerTimeMs: Date.parse("2026-10-04T00:00:00.000Z"),
      bids: [
        { price: 85000, quantityBtc: 1, restingOrderCount: 1 },
        { price: 84999, quantityBtc: 1, restingOrderCount: 1 },
      ],
      asks: [
        { price: 85001, quantityBtc: 1, restingOrderCount: 1 },
        { price: 85002, quantityBtc: 1, restingOrderCount: 1 },
      ],
    },
    retrievedAt: "2026-10-04T00:00:01.000Z",
  });
  assert.equal(result.bands.find((band) => band.bandBps === 50)?.coverage, "PARTIAL");
});
