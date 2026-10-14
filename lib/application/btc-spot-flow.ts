import {
  BINANCE_SPOT_FLOW_INTERVAL_MS,
  type BinanceSpotKline,
} from "../data/binance-spot-flow";

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
