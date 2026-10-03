import type {
  BinanceFuturesOrderBookSnapshot,
} from "../data/binance-futures-order-book";
import type {
  HyperliquidPerpOrderBookSnapshot,
} from "../data/hyperliquid-perp-order-book";

export const BTC_PERP_ORDER_BOOK_METHODOLOGY = "btc-perp-depth-geometry-v1" as const;
export const BTC_PERP_DEPTH_BANDS_BPS = [5, 10, 25, 50] as const;

export type BtcPerpOrderBookBand = {
  bandBps: 5 | 10 | 25 | 50;
  bidDepthBtc: number;
  askDepthBtc: number;
  baseDepthImbalance: number | null;
  bidRestingOrderCount: number | null;
  askRestingOrderCount: number | null;
  coverage: "COMPLETE" | "PARTIAL";
};

export type BtcPerpOrderBookLiquiditySnapshot = {
  asset: "BTC";
  marketType: "PERPETUAL";
  venue: "HYPERLIQUID" | "BINANCE_FUTURES";
  instrument: "BTC" | "BTCUSDT";
  observedAt: string;
  retrievedAt: string;
  providerTimestampKind: "BOOK_SNAPSHOT_TIME" | "TRANSACTION_TIME";
  providerMessageOutputAt: string | null;
  providerSequence: number | null;
  bestBid: number;
  bestAsk: number;
  mid: number;
  spread: number;
  spreadBps: number;
  levelCountBid: number;
  levelCountAsk: number;
  bands: BtcPerpOrderBookBand[];
  methodology: typeof BTC_PERP_ORDER_BOOK_METHODOLOGY;
};

type NormalizedLevel = {
  price: number;
  quantityBtc: number;
  restingOrderCount: number | null;
};

function imbalance(bid: number, ask: number): number | null {
  const denominator = bid + ask;
  return denominator > 0 ? (bid - ask) / denominator : null;
}

function isoFromMs(value: number, label: string): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer millisecond timestamp`);
  }
  return new Date(value).toISOString();
}

function build(input: {
  venue: BtcPerpOrderBookLiquiditySnapshot["venue"];
  instrument: BtcPerpOrderBookLiquiditySnapshot["instrument"];
  observedAtMs: number;
  retrievedAt: string;
  providerTimestampKind: BtcPerpOrderBookLiquiditySnapshot["providerTimestampKind"];
  providerMessageOutputAtMs: number | null;
  providerSequence: number | null;
  bids: NormalizedLevel[];
  asks: NormalizedLevel[];
}): BtcPerpOrderBookLiquiditySnapshot {
  const retrievedAtMs = Date.parse(input.retrievedAt);
  if (!Number.isFinite(retrievedAtMs)) throw new Error("BTC perp order book requires valid retrievedAt");
  if (input.bids.length === 0 || input.asks.length === 0) {
    throw new Error("BTC perp order book requires non-empty bid and ask sides");
  }

  const bestBid = input.bids[0].price;
  const bestAsk = input.asks[0].price;
  if (!(bestBid > 0 && bestAsk > bestBid)) {
    throw new Error("BTC perp order book requires bestBid < bestAsk");
  }

  const observedAt = isoFromMs(input.observedAtMs, "provider observedAt");
  const mid = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;
  const spreadBps = (spread / mid) * 10_000;
  const deepestBid = input.bids.at(-1)?.price ?? bestBid;
  const deepestAsk = input.asks.at(-1)?.price ?? bestAsk;

  const bands = BTC_PERP_DEPTH_BANDS_BPS.map((bandBps): BtcPerpOrderBookBand => {
    const fraction = bandBps / 10_000;
    const bidFloor = mid * (1 - fraction);
    const askCeiling = mid * (1 + fraction);
    const bids = input.bids.filter((level) => level.price >= bidFloor);
    const asks = input.asks.filter((level) => level.price <= askCeiling);
    const bidDepthBtc = bids.reduce((sum, level) => sum + level.quantityBtc, 0);
    const askDepthBtc = asks.reduce((sum, level) => sum + level.quantityBtc, 0);
    const bidCounts = bids.map((level) => level.restingOrderCount);
    const askCounts = asks.map((level) => level.restingOrderCount);

    return {
      bandBps,
      bidDepthBtc,
      askDepthBtc,
      baseDepthImbalance: imbalance(bidDepthBtc, askDepthBtc),
      bidRestingOrderCount: bidCounts.every((value) => value !== null)
        ? bidCounts.reduce((sum, value) => sum + (value ?? 0), 0)
        : null,
      askRestingOrderCount: askCounts.every((value) => value !== null)
        ? askCounts.reduce((sum, value) => sum + (value ?? 0), 0)
        : null,
      coverage: deepestBid <= bidFloor && deepestAsk >= askCeiling ? "COMPLETE" : "PARTIAL",
    };
  });

  return {
    asset: "BTC",
    marketType: "PERPETUAL",
    venue: input.venue,
    instrument: input.instrument,
    observedAt,
    retrievedAt: new Date(retrievedAtMs).toISOString(),
    providerTimestampKind: input.providerTimestampKind,
    providerMessageOutputAt: input.providerMessageOutputAtMs === null
      ? null
      : isoFromMs(input.providerMessageOutputAtMs, "provider message output time"),
    providerSequence: input.providerSequence,
    bestBid,
    bestAsk,
    mid,
    spread,
    spreadBps,
    levelCountBid: input.bids.length,
    levelCountAsk: input.asks.length,
    bands,
    methodology: BTC_PERP_ORDER_BOOK_METHODOLOGY,
  };
}

export function buildHyperliquidBtcPerpLiquiditySnapshot(input: {
  snapshot: HyperliquidPerpOrderBookSnapshot;
  retrievedAt: string;
}): BtcPerpOrderBookLiquiditySnapshot {
  return build({
    venue: "HYPERLIQUID",
    instrument: "BTC",
    observedAtMs: input.snapshot.providerTimeMs,
    retrievedAt: input.retrievedAt,
    providerTimestampKind: "BOOK_SNAPSHOT_TIME",
    providerMessageOutputAtMs: null,
    providerSequence: null,
    bids: input.snapshot.bids.map((level) => ({
      price: level.price,
      quantityBtc: level.quantityBtc,
      restingOrderCount: level.restingOrderCount,
    })),
    asks: input.snapshot.asks.map((level) => ({
      price: level.price,
      quantityBtc: level.quantityBtc,
      restingOrderCount: level.restingOrderCount,
    })),
  });
}

export function buildBinanceFuturesBtcPerpLiquiditySnapshot(input: {
  snapshot: BinanceFuturesOrderBookSnapshot;
  retrievedAt: string;
}): BtcPerpOrderBookLiquiditySnapshot {
  return build({
    venue: "BINANCE_FUTURES",
    instrument: "BTCUSDT",
    observedAtMs: input.snapshot.transactionTimeMs,
    retrievedAt: input.retrievedAt,
    providerTimestampKind: "TRANSACTION_TIME",
    providerMessageOutputAtMs: input.snapshot.messageOutputTimeMs,
    providerSequence: input.snapshot.lastUpdateId,
    bids: input.snapshot.bids.map((level) => ({
      price: level.priceUsdt,
      quantityBtc: level.quantityBtc,
      restingOrderCount: null,
    })),
    asks: input.snapshot.asks.map((level) => ({
      price: level.priceUsdt,
      quantityBtc: level.quantityBtc,
      restingOrderCount: null,
    })),
  });
}
