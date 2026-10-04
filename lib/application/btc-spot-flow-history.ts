import { createHash } from "node:crypto";
import type { Evidence } from "../domain/types";
import {
  BTC_SPOT_FLOW_METHODOLOGY,
  type BtcSpotFlowWindow,
} from "./btc-spot-flow";

export const BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY =
  "binance-btcusdt-5m-taker-flow-snapshot-v1" as const;

type DurableBtcSpotFlowPayload = {
  version: "v1";
  window: BtcSpotFlowWindow;
};

function digest(parts: readonly (string | number | null)[]): string {
  return createHash("sha256")
    .update(JSON.stringify(parts), "utf8")
    .digest("hex")
    .slice(0, 32);
}

function windowKey(window: BtcSpotFlowWindow): string {
  return `binance-btcusdt-5m-v1-${digest([
    window.venue,
    window.pair,
    window.providerIntervalStartMs,
  ])}`;
}

function snapshotId(window: BtcSpotFlowWindow): string {
  return `binance-btcusdt-5m-flow-v1-${digest([
    windowKey(window),
    window.totalBaseVolumeBtc,
    window.takerBuyBaseVolumeBtc,
    window.takerSellBaseVolumeBtc,
    window.netTakerBaseVolumeBtc,
    window.takerBuyShare,
    window.tradeCount,
  ])}`;
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function nearlyEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= scale * 1e-12;
}

function nonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Binance durable spot-flow ${label} must be finite and non-negative`);
  }
}

function assertWindow(window: BtcSpotFlowWindow): void {
  if (
    window.asset !== "BTC"
    || window.venue !== "BINANCE"
    || window.pair !== "BTCUSDT"
    || window.baseUnit !== "BTC"
  ) {
    throw new Error("Binance durable spot-flow requires BTC / BINANCE / BTCUSDT / BTC identity");
  }
  if (
    window.windowSeconds !== 300
    || window.coverage !== "COMPLETE"
    || window.methodology !== BTC_SPOT_FLOW_METHODOLOGY
  ) {
    throw new Error("Binance durable spot-flow requires a complete venue-native 5m window");
  }
  if (
    !Number.isInteger(window.providerIntervalStartMs)
    || window.providerIntervalStartMs < 0
    || !validTimestamp(window.observedAt)
  ) {
    throw new Error("Binance durable spot-flow requires valid provider interval timestamps");
  }

  const expectedObservedAt = new Date(window.providerIntervalStartMs + window.windowSeconds * 1000).toISOString();
  if (window.observedAt !== expectedObservedAt) {
    throw new Error("Binance durable spot-flow observedAt must equal the completed 5m boundary");
  }

  nonNegativeFinite(window.totalBaseVolumeBtc, "total volume");
  nonNegativeFinite(window.takerBuyBaseVolumeBtc, "taker-buy volume");
  nonNegativeFinite(window.takerSellBaseVolumeBtc, "taker-sell volume");
  if (!Number.isFinite(window.netTakerBaseVolumeBtc)) {
    throw new Error("Binance durable spot-flow net taker volume must be finite");
  }
  if (!Number.isInteger(window.tradeCount) || window.tradeCount < 0) {
    throw new Error("Binance durable spot-flow tradeCount must be a non-negative integer");
  }

  if (!nearlyEqual(
    window.takerBuyBaseVolumeBtc + window.takerSellBaseVolumeBtc,
    window.totalBaseVolumeBtc,
  )) {
    throw new Error("Binance durable spot-flow buy/sell volume must reconcile to total volume");
  }
  if (!nearlyEqual(
    window.takerBuyBaseVolumeBtc - window.takerSellBaseVolumeBtc,
    window.netTakerBaseVolumeBtc,
  )) {
    throw new Error("Binance durable spot-flow net taker volume is inconsistent");
  }

  if (window.totalBaseVolumeBtc === 0) {
    if (window.takerBuyShare !== null) {
      throw new Error("Binance durable spot-flow zero-volume window requires null buy share");
    }
  } else {
    if (
      window.takerBuyShare === null
      || !Number.isFinite(window.takerBuyShare)
      || window.takerBuyShare < 0
      || window.takerBuyShare > 1
      || !nearlyEqual(
        window.takerBuyShare,
        window.takerBuyBaseVolumeBtc / window.totalBaseVolumeBtc,
      )
    ) {
      throw new Error("Binance durable spot-flow taker-buy share is inconsistent");
    }
  }
}

export function btcSpotFlowWindowsToEvidence(input: {
  windows: BtcSpotFlowWindow[];
  retrievedAt: string;
}): Evidence[] {
  if (!validTimestamp(input.retrievedAt)) {
    throw new Error("Binance durable spot-flow requires a valid retrieval timestamp");
  }
  const retrievedAtMs = Date.parse(input.retrievedAt);

  return input.windows.map((window) => {
    assertWindow(window);
    if (Date.parse(window.observedAt) > retrievedAtMs) {
      throw new Error("Binance durable spot-flow cannot persist a window before it is complete");
    }

    const key = windowKey(window);
    const payload: DurableBtcSpotFlowPayload = {
      version: "v1",
      window,
    };

    return {
      id: snapshotId(window),
      sourceId: "binance-spot",
      kind: "OBSERVATION",
      subject: "Binance BTCUSDT completed 5m taker flow",
      content: JSON.stringify(payload),
      capturedAt: input.retrievedAt,
      retrievedAt: input.retrievedAt,
      // A completed kline becomes factual at the first instant after its provider interval.
      // The retrieval cutoff still controls what P365 actually knew at any historical as-of.
      releasedAt: window.observedAt,
      metadata: {
        methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
        asset: window.asset,
        venue: window.venue,
        pair: window.pair,
        coverage: window.coverage,
        baseUnit: window.baseUnit,
        windowKey: key,
        providerIntervalStartMs: window.providerIntervalStartMs,
        observedAt: window.observedAt,
        windowSeconds: window.windowSeconds,
        totalBaseVolumeBtc: window.totalBaseVolumeBtc,
        takerBuyBaseVolumeBtc: window.takerBuyBaseVolumeBtc,
        takerSellBaseVolumeBtc: window.takerSellBaseVolumeBtc,
        netTakerBaseVolumeBtc: window.netTakerBaseVolumeBtc,
        takerBuyShare: window.takerBuyShare,
        tradeCount: window.tradeCount,
      },
    };
  });
}

export function btcSpotFlowWindowFromEvidence(
  evidence: Evidence,
): BtcSpotFlowWindow | null {
  if (
    evidence.sourceId !== "binance-spot"
    || evidence.kind !== "OBSERVATION"
    || evidence.metadata?.methodology !== BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(evidence.content) as Partial<DurableBtcSpotFlowPayload>;
    if (parsed.version !== "v1" || !parsed.window) return null;
    assertWindow(parsed.window);
    if (parsed.window.observedAt !== evidence.releasedAt) return null;
    if (windowKey(parsed.window) !== evidence.metadata?.windowKey) return null;
    if (snapshotId(parsed.window) !== evidence.id) return null;
    return parsed.window;
  } catch {
    return null;
  }
}
