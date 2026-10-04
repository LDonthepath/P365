import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBinanceBtcOrderBookLiquiditySnapshot,
} from "./btc-order-book-liquidity";
import {
  buildHyperliquidBtcPerpLiquiditySnapshot,
} from "./btc-perp-order-book-liquidity";
import {
  BINANCE_BTC_SPOT_ORDER_BOOK_DURABLE_METHODOLOGY,
  HYPERLIQUID_BTC_PERP_ORDER_BOOK_DURABLE_METHODOLOGY,
  binanceBtcSpotOrderBookSnapshotFromEvidence,
  binanceBtcSpotOrderBookSnapshotToEvidence,
  hyperliquidBtcPerpOrderBookSnapshotFromEvidence,
  hyperliquidBtcPerpOrderBookSnapshotToEvidence,
} from "./btc-order-book-history";

function binanceSummary(retrievedAt: string) {
  return buildBinanceBtcOrderBookLiquiditySnapshot({
    snapshot: {
      symbol: "BTCUSDT",
      lastUpdateId: 12345,
      bids: [
        { priceUsdt: 100000, quantityBtc: 1 },
        { priceUsdt: 99950, quantityBtc: 2 },
        { priceUsdt: 99500, quantityBtc: 3 },
      ],
      asks: [
        { priceUsdt: 100010, quantityBtc: 1.5 },
        { priceUsdt: 100060, quantityBtc: 2.5 },
        { priceUsdt: 100600, quantityBtc: 3.5 },
      ],
    },
    retrievedAt,
  });
}

function hyperliquidSummary(retrievedAt: string) {
  return buildHyperliquidBtcPerpLiquiditySnapshot({
    snapshot: {
      coin: "BTC",
      providerTimeMs: Date.parse("2026-10-04T13:00:00.000Z"),
      bids: [
        { price: 100000, quantityBtc: 2, restingOrderCount: 4 },
        { price: 99990, quantityBtc: 3, restingOrderCount: 5 },
      ],
      asks: [
        { price: 100010, quantityBtc: 1, restingOrderCount: 2 },
        { price: 100020, quantityBtc: 2, restingOrderCount: 3 },
      ],
    },
    retrievedAt,
  });
}

test("Binance durable order-book Evidence uses P365 retrieval time as the sampling identity", () => {
  const first = binanceBtcSpotOrderBookSnapshotToEvidence(
    binanceSummary("2026-10-04T13:00:01.000Z"),
  );
  const repeat = binanceBtcSpotOrderBookSnapshotToEvidence(
    binanceSummary("2026-10-04T13:00:01.000Z"),
  );
  const laterSample = binanceBtcSpotOrderBookSnapshotToEvidence(
    binanceSummary("2026-10-04T13:05:01.000Z"),
  );

  assert.equal(first.id, repeat.id);
  assert.notEqual(first.id, laterSample.id);
  assert.equal(first.sourceId, "binance-spot");
  assert.equal(first.kind, "OBSERVATION");
  assert.equal(
    first.metadata?.methodology,
    BINANCE_BTC_SPOT_ORDER_BOOK_DURABLE_METHODOLOGY,
  );
  assert.equal(
    first.metadata?.observationEffectiveAt,
    "2026-10-04T13:00:01.000Z",
  );
  assert.deepEqual(
    binanceBtcSpotOrderBookSnapshotFromEvidence(first),
    binanceSummary("2026-10-04T13:00:01.000Z"),
  );

  const payload = JSON.parse(first.content) as { snapshot: Record<string, unknown> };
  assert.equal("bids" in payload.snapshot, false);
  assert.equal("asks" in payload.snapshot, false);
  assert.ok(Array.isArray(payload.snapshot.bands));
});

test("Hyperliquid durable Evidence remains provider-time idempotent across later refetches", () => {
  const first = hyperliquidBtcPerpOrderBookSnapshotToEvidence(
    hyperliquidSummary("2026-10-04T13:00:01.000Z"),
  );
  const laterRefetch = hyperliquidBtcPerpOrderBookSnapshotToEvidence(
    hyperliquidSummary("2026-10-04T13:00:05.000Z"),
  );

  assert.equal(first.id, laterRefetch.id);
  assert.equal(first.releasedAt, "2026-10-04T13:00:00.000Z");
  assert.equal(
    first.metadata?.observationEffectiveAt,
    "2026-10-04T13:00:00.000Z",
  );
  assert.equal(
    first.metadata?.methodology,
    HYPERLIQUID_BTC_PERP_ORDER_BOOK_DURABLE_METHODOLOGY,
  );
  assert.deepEqual(
    hyperliquidBtcPerpOrderBookSnapshotFromEvidence(first),
    hyperliquidSummary("2026-10-04T13:00:01.000Z"),
  );

  const payload = JSON.parse(first.content) as { snapshot: Record<string, unknown> };
  assert.equal("bids" in payload.snapshot, false);
  assert.equal("asks" in payload.snapshot, false);
  assert.ok(Array.isArray(payload.snapshot.bands));
});

test("order-book Evidence parser fails closed when durable methodology or identity is tampered", () => {
  const spot = binanceBtcSpotOrderBookSnapshotToEvidence(
    binanceSummary("2026-10-04T13:00:01.000Z"),
  );
  const perp = hyperliquidBtcPerpOrderBookSnapshotToEvidence(
    hyperliquidSummary("2026-10-04T13:00:01.000Z"),
  );

  assert.equal(
    binanceBtcSpotOrderBookSnapshotFromEvidence({
      ...spot,
      id: "tampered",
    }),
    null,
  );
  assert.equal(
    hyperliquidBtcPerpOrderBookSnapshotFromEvidence({
      ...perp,
      metadata: { ...perp.metadata, methodology: "wrong" },
    }),
    null,
  );
});
