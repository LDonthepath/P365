import type {
  BinanceOrderBookLevel,
  BinanceOrderBookSnapshot,
} from "../data/binance-order-book";

export const BTC_ORDER_BOOK_LIQUIDITY_METHODOLOGY = "binance-btcusdt-depth-geometry-v1" as const;
export const BTC_ORDER_BOOK_DEPTH_BANDS_BPS = [5, 10, 25, 50] as const;

export type BtcOrderBookDepthBand = {
  bandBps: 5 | 10 | 25 | 50;
  bidDepthBtc: number;
  askDepthBtc: number;
  bidNotionalUsdt: number;
  askNotionalUsdt: number;
  quoteNotionalImbalance: number | null;
  coverage: "COMPLETE" | "PARTIAL";
};

export type BtcOrderBookLiquiditySnapshot = {
  asset: "BTC";
  venue: "BINANCE";
  pair: "BTCUSDT";
  snapshotTimeBasis: "P365_RETRIEVED_AT";
  retrievedAt: string;
  providerLastUpdateId: number;
  bestBidUsdt: number;
  bestAskUsdt: number;
  midUsdt: number;
  spreadUsdt: number;
  spreadBps: number;
  deepestBidUsdt: number;
  deepestAskUsdt: number;
  levelCountBid: number;
  levelCountAsk: number;
  bands: BtcOrderBookDepthBand[];
  methodology: typeof BTC_ORDER_BOOK_LIQUIDITY_METHODOLOGY;
};

function sumBase(levels: BinanceOrderBookLevel[]): number {
  return levels.reduce((sum, level) => sum + level.quantityBtc, 0);
}

function sumQuote(levels: BinanceOrderBookLevel[]): number {
  return levels.reduce((sum, level) => sum + level.priceUsdt * level.quantityBtc, 0);
}

function imbalance(bid: number, ask: number): number | null {
  const denominator = bid + ask;
  return denominator > 0 ? (bid - ask) / denominator : null;
}

export function buildBinanceBtcOrderBookLiquiditySnapshot(input: {
  snapshot: BinanceOrderBookSnapshot;
  retrievedAt: string;
}): BtcOrderBookLiquiditySnapshot {
  const { snapshot } = input;
  const retrievedAtMs = Date.parse(input.retrievedAt);
  if (!Number.isFinite(retrievedAtMs)) {
    throw new Error("Binance order-book liquidity requires a valid retrievedAt timestamp");
  }
  if (snapshot.bids.length === 0 || snapshot.asks.length === 0) {
    throw new Error("Binance order-book liquidity requires non-empty bid and ask sides");
  }

  const bestBidUsdt = snapshot.bids[0].priceUsdt;
  const bestAskUsdt = snapshot.asks[0].priceUsdt;
  if (!(bestBidUsdt > 0 && bestAskUsdt > bestBidUsdt)) {
    throw new Error("Binance order-book liquidity requires bestBid < bestAsk");
  }

  const midUsdt = (bestBidUsdt + bestAskUsdt) / 2;
  const spreadUsdt = bestAskUsdt - bestBidUsdt;
  const spreadBps = (spreadUsdt / midUsdt) * 10_000;
  const deepestBidUsdt = snapshot.bids.at(-1)?.priceUsdt ?? bestBidUsdt;
  const deepestAskUsdt = snapshot.asks.at(-1)?.priceUsdt ?? bestAskUsdt;

  const bands = BTC_ORDER_BOOK_DEPTH_BANDS_BPS.map((bandBps): BtcOrderBookDepthBand => {
    const fraction = bandBps / 10_000;
    const bidFloor = midUsdt * (1 - fraction);
    const askCeiling = midUsdt * (1 + fraction);

    const bidLevels = snapshot.bids.filter((level) => level.priceUsdt >= bidFloor);
    const askLevels = snapshot.asks.filter((level) => level.priceUsdt <= askCeiling);

    const bidDepthBtc = sumBase(bidLevels);
    const askDepthBtc = sumBase(askLevels);
    const bidNotionalUsdt = sumQuote(bidLevels);
    const askNotionalUsdt = sumQuote(askLevels);

    return {
      bandBps,
      bidDepthBtc,
      askDepthBtc,
      bidNotionalUsdt,
      askNotionalUsdt,
      quoteNotionalImbalance: imbalance(bidNotionalUsdt, askNotionalUsdt),
      coverage: deepestBidUsdt <= bidFloor && deepestAskUsdt >= askCeiling
        ? "COMPLETE"
        : "PARTIAL",
    };
  });

  return {
    asset: "BTC",
    venue: "BINANCE",
    pair: "BTCUSDT",
    snapshotTimeBasis: "P365_RETRIEVED_AT",
    retrievedAt: new Date(retrievedAtMs).toISOString(),
    providerLastUpdateId: snapshot.lastUpdateId,
    bestBidUsdt,
    bestAskUsdt,
    midUsdt,
    spreadUsdt,
    spreadBps,
    deepestBidUsdt,
    deepestAskUsdt,
    levelCountBid: snapshot.bids.length,
    levelCountAsk: snapshot.asks.length,
    bands,
    methodology: BTC_ORDER_BOOK_LIQUIDITY_METHODOLOGY,
  };
}
