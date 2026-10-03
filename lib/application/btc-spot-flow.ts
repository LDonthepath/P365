import {
  BINANCE_SPOT_FLOW_INTERVAL_MS,
  type BinanceSpotKline,
} from "../data/binance-spot-flow";
import type { BybitSpotTrade } from "../data/bybit-spot-flow";

export const BTC_SPOT_FLOW_METHODOLOGY = "venue-native-taker-flow-v1" as const;

export type BtcSpotFlowWindow = {
  asset: "BTC";
  venue: "BINANCE";
  pair: "BTCUSDT";
  baseUnit: "BTC";
  providerIntervalStartMs: number;
  observedAt: string;
  windowSeconds: 300;
  totalBaseVolumeBtc: number;
  takerBuyBaseVolumeBtc: number;
  takerSellBaseVolumeBtc: number;
  netTakerBaseVolumeBtc: number;
  takerBuyShare: number | null;
  tradeCount: number;
  coverage: "COMPLETE";
  methodology: typeof BTC_SPOT_FLOW_METHODOLOGY;
};

export type BybitBtcSpotTradeSample = {
  asset: "BTC";
  venue: "BYBIT";
  pair: "BTCUSDT";
  baseUnit: "BTC";
  sampleStart: string | null;
  sampleEnd: string | null;
  coveredSpanMs: number;
  coversFullFiveMinuteWindow: boolean;
  totalBaseVolumeBtc: number;
  takerBuyBaseVolumeBtc: number;
  takerSellBaseVolumeBtc: number;
  netTakerBaseVolumeBtc: number;
  takerBuyShare: number | null;
  tradeCount: number;
  coverage: "RECENT_SAMPLE";
  methodology: typeof BTC_SPOT_FLOW_METHODOLOGY;
};

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function buildBinanceBtcSpotFlowWindow(bar: BinanceSpotKline): BtcSpotFlowWindow {
  const takerSellBaseVolumeBtc = bar.baseVolumeBtc - bar.takerBuyBaseVolumeBtc;
  if (takerSellBaseVolumeBtc < 0) {
    throw new Error("Binance spot-flow invariant failed: taker sell base volume is negative");
  }
  const observedAtMs = bar.providerIntervalStartMs + BINANCE_SPOT_FLOW_INTERVAL_MS;

  return {
    asset: "BTC",
    venue: "BINANCE",
    pair: "BTCUSDT",
    baseUnit: "BTC",
    providerIntervalStartMs: bar.providerIntervalStartMs,
    observedAt: new Date(observedAtMs).toISOString(),
    windowSeconds: 300,
    totalBaseVolumeBtc: bar.baseVolumeBtc,
    takerBuyBaseVolumeBtc: bar.takerBuyBaseVolumeBtc,
    takerSellBaseVolumeBtc,
    netTakerBaseVolumeBtc: bar.takerBuyBaseVolumeBtc - takerSellBaseVolumeBtc,
    takerBuyShare: ratio(bar.takerBuyBaseVolumeBtc, bar.baseVolumeBtc),
    tradeCount: bar.tradeCount,
    coverage: "COMPLETE",
    methodology: BTC_SPOT_FLOW_METHODOLOGY,
  };
}

export function summarizeBybitRecentBtcSpotTrades(
  trades: readonly BybitSpotTrade[],
): BybitBtcSpotTradeSample {
  const sorted = [...trades].sort((left, right) =>
    left.executedAtMs - right.executedAtMs || left.execId.localeCompare(right.execId));

  let buy = 0;
  let sell = 0;
  for (const trade of sorted) {
    if (trade.takerSide === "BUY") buy += trade.baseSizeBtc;
    else sell += trade.baseSizeBtc;
  }

  const first = sorted[0]?.executedAtMs ?? null;
  const last = sorted.at(-1)?.executedAtMs ?? null;
  const coveredSpanMs = first === null || last === null ? 0 : Math.max(0, last - first);
  const total = buy + sell;

  return {
    asset: "BTC",
    venue: "BYBIT",
    pair: "BTCUSDT",
    baseUnit: "BTC",
    sampleStart: first === null ? null : new Date(first).toISOString(),
    sampleEnd: last === null ? null : new Date(last).toISOString(),
    coveredSpanMs,
    coversFullFiveMinuteWindow: coveredSpanMs >= BINANCE_SPOT_FLOW_INTERVAL_MS,
    totalBaseVolumeBtc: total,
    takerBuyBaseVolumeBtc: buy,
    takerSellBaseVolumeBtc: sell,
    netTakerBaseVolumeBtc: buy - sell,
    takerBuyShare: ratio(buy, total),
    tradeCount: sorted.length,
    coverage: "RECENT_SAMPLE",
    methodology: BTC_SPOT_FLOW_METHODOLOGY,
  };
}
