import { createHash } from "node:crypto";
import type { Evidence } from "../domain/types";
import {
  BTC_ORDER_BOOK_DEPTH_BANDS_BPS,
  BTC_ORDER_BOOK_LIQUIDITY_METHODOLOGY,
  type BtcOrderBookLiquiditySnapshot,
} from "./btc-order-book-liquidity";
import {
  BTC_PERP_DEPTH_BANDS_BPS,
  BTC_PERP_ORDER_BOOK_METHODOLOGY,
  type BtcPerpOrderBookLiquiditySnapshot,
} from "./btc-perp-order-book-liquidity";

export const BINANCE_BTC_SPOT_ORDER_BOOK_DURABLE_METHODOLOGY =
  "binance-btcusdt-order-book-geometry-snapshot-v1" as const;

export const HYPERLIQUID_BTC_PERP_ORDER_BOOK_DURABLE_METHODOLOGY =
  "hyperliquid-btc-perp-order-book-geometry-snapshot-v1" as const;

type DurableBinanceSpotOrderBookPayload = {
  version: "v1";
  snapshot: BtcOrderBookLiquiditySnapshot;
};

type DurableHyperliquidPerpOrderBookPayload = {
  version: "v1";
  snapshot: BtcPerpOrderBookLiquiditySnapshot;
};

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Durable BTC order-book ${label} must be finite`);
  }
}

function assertBands(
  bands: Array<{
    bandBps: number;
    bidDepthBtc: number;
    askDepthBtc: number;
    coverage: "COMPLETE" | "PARTIAL";
  }>,
  expected: readonly number[],
): void {
  if (
    bands.length !== expected.length
    || bands.some((band, index) => band.bandBps !== expected[index])
  ) {
    throw new Error("Durable BTC order-book snapshot requires frozen 5/10/25/50 bps bands");
  }
  for (const band of bands) {
    finite(band.bidDepthBtc, "bid depth");
    finite(band.askDepthBtc, "ask depth");
    if (band.bidDepthBtc < 0 || band.askDepthBtc < 0) {
      throw new Error("Durable BTC order-book depth must be non-negative");
    }
    if (band.coverage !== "COMPLETE" && band.coverage !== "PARTIAL") {
      throw new Error("Durable BTC order-book coverage is invalid");
    }
  }
}

function assertBinanceSnapshot(snapshot: BtcOrderBookLiquiditySnapshot): void {
  if (
    snapshot.asset !== "BTC"
    || snapshot.venue !== "BINANCE"
    || snapshot.pair !== "BTCUSDT"
    || snapshot.snapshotTimeBasis !== "P365_RETRIEVED_AT"
    || snapshot.methodology !== BTC_ORDER_BOOK_LIQUIDITY_METHODOLOGY
  ) {
    throw new Error("Durable Binance order-book snapshot identity is invalid");
  }
  if (!validTimestamp(snapshot.retrievedAt)) {
    throw new Error("Durable Binance order-book snapshot requires valid retrievedAt");
  }
  if (!Number.isInteger(snapshot.providerLastUpdateId) || snapshot.providerLastUpdateId < 0) {
    throw new Error("Durable Binance order-book snapshot requires providerLastUpdateId");
  }
  finite(snapshot.bestBidUsdt, "best bid");
  finite(snapshot.bestAskUsdt, "best ask");
  finite(snapshot.midUsdt, "mid");
  finite(snapshot.spreadBps, "spread bps");
  if (!(snapshot.bestBidUsdt > 0 && snapshot.bestAskUsdt > snapshot.bestBidUsdt)) {
    throw new Error("Durable Binance order-book snapshot requires bestBid < bestAsk");
  }
  assertBands(snapshot.bands, BTC_ORDER_BOOK_DEPTH_BANDS_BPS);
}

function assertHyperliquidSnapshot(snapshot: BtcPerpOrderBookLiquiditySnapshot): void {
  if (
    snapshot.asset !== "BTC"
    || snapshot.marketType !== "PERPETUAL"
    || snapshot.venue !== "HYPERLIQUID"
    || snapshot.instrument !== "BTC"
    || snapshot.providerTimestampKind !== "BOOK_SNAPSHOT_TIME"
    || snapshot.methodology !== BTC_PERP_ORDER_BOOK_METHODOLOGY
  ) {
    throw new Error("Durable Hyperliquid order-book snapshot identity is invalid");
  }
  if (!validTimestamp(snapshot.observedAt) || !validTimestamp(snapshot.retrievedAt)) {
    throw new Error("Durable Hyperliquid order-book snapshot requires valid timestamps");
  }
  if (Date.parse(snapshot.observedAt) > Date.parse(snapshot.retrievedAt)) {
    throw new Error("Durable Hyperliquid order-book snapshot cannot be known before provider time");
  }
  finite(snapshot.bestBid, "best bid");
  finite(snapshot.bestAsk, "best ask");
  finite(snapshot.mid, "mid");
  finite(snapshot.spreadBps, "spread bps");
  if (!(snapshot.bestBid > 0 && snapshot.bestAsk > snapshot.bestBid)) {
    throw new Error("Durable Hyperliquid order-book snapshot requires bestBid < bestAsk");
  }
  assertBands(snapshot.bands, BTC_PERP_DEPTH_BANDS_BPS);
}

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex")
    .slice(0, 32);
}

function binanceEvidenceId(snapshot: BtcOrderBookLiquiditySnapshot): string {
  // Binance REST depth has no provider timestamp. Retrieval time is therefore
  // part of the factual sampling identity; lastUpdateId remains provider lineage.
  return `binance-btcusdt-order-book-v1-${digest(snapshot)}`;
}

function hyperliquidEvidenceId(snapshot: BtcPerpOrderBookLiquiditySnapshot): string {
  // Hyperliquid supplies a provider-native book timestamp. Re-fetching the same
  // provider fact later must therefore resolve to the same canonical identity.
  // JSON serialization omits the explicit undefined retrieval-time field.
  return `hyperliquid-btc-perp-order-book-v1-${digest({
    ...snapshot,
    retrievedAt: undefined,
  })}`;
}

export function binanceBtcSpotOrderBookSnapshotToEvidence(
  snapshot: BtcOrderBookLiquiditySnapshot,
): Evidence {
  assertBinanceSnapshot(snapshot);
  const payload: DurableBinanceSpotOrderBookPayload = { version: "v1", snapshot };
  return {
    id: binanceEvidenceId(snapshot),
    sourceId: "binance-spot",
    kind: "OBSERVATION",
    subject: "Binance BTCUSDT order-book geometry snapshot",
    content: JSON.stringify(payload),
    capturedAt: snapshot.retrievedAt,
    retrievedAt: snapshot.retrievedAt,
    metadata: {
      methodology: BINANCE_BTC_SPOT_ORDER_BOOK_DURABLE_METHODOLOGY,
      observationEffectiveAt: snapshot.retrievedAt,
      asset: "BTC",
      marketType: "SPOT",
      venue: "BINANCE",
      instrument: "BTCUSDT",
      snapshotTimeBasis: snapshot.snapshotTimeBasis,
      providerLastUpdateId: snapshot.providerLastUpdateId,
      completeBandCount: snapshot.bands.filter((band) => band.coverage === "COMPLETE").length,
      spreadBps: snapshot.spreadBps,
    },
  };
}

export function hyperliquidBtcPerpOrderBookSnapshotToEvidence(
  snapshot: BtcPerpOrderBookLiquiditySnapshot,
): Evidence {
  assertHyperliquidSnapshot(snapshot);
  const payload: DurableHyperliquidPerpOrderBookPayload = { version: "v1", snapshot };
  return {
    id: hyperliquidEvidenceId(snapshot),
    sourceId: "hyperliquid",
    kind: "OBSERVATION",
    subject: "Hyperliquid BTC perpetual order-book geometry snapshot",
    content: JSON.stringify(payload),
    capturedAt: snapshot.retrievedAt,
    retrievedAt: snapshot.retrievedAt,
    releasedAt: snapshot.observedAt,
    metadata: {
      methodology: HYPERLIQUID_BTC_PERP_ORDER_BOOK_DURABLE_METHODOLOGY,
      observationEffectiveAt: snapshot.observedAt,
      asset: "BTC",
      marketType: "PERPETUAL",
      venue: "HYPERLIQUID",
      instrument: "BTC",
      providerTimestampKind: snapshot.providerTimestampKind,
      completeBandCount: snapshot.bands.filter((band) => band.coverage === "COMPLETE").length,
      spreadBps: snapshot.spreadBps,
    },
  };
}

export function binanceBtcSpotOrderBookSnapshotFromEvidence(
  evidence: Evidence,
): BtcOrderBookLiquiditySnapshot | null {
  if (
    evidence.sourceId !== "binance-spot"
    || evidence.kind !== "OBSERVATION"
    || evidence.metadata?.methodology !== BINANCE_BTC_SPOT_ORDER_BOOK_DURABLE_METHODOLOGY
  ) return null;

  try {
    const parsed = JSON.parse(evidence.content) as Partial<DurableBinanceSpotOrderBookPayload>;
    if (parsed.version !== "v1" || !parsed.snapshot) return null;
    assertBinanceSnapshot(parsed.snapshot);
    if (binanceEvidenceId(parsed.snapshot) !== evidence.id) return null;
    if (parsed.snapshot.retrievedAt !== evidence.retrievedAt) return null;
    if (evidence.metadata?.observationEffectiveAt !== parsed.snapshot.retrievedAt) return null;
    return parsed.snapshot;
  } catch {
    return null;
  }
}

export function hyperliquidBtcPerpOrderBookSnapshotFromEvidence(
  evidence: Evidence,
): BtcPerpOrderBookLiquiditySnapshot | null {
  if (
    evidence.sourceId !== "hyperliquid"
    || evidence.kind !== "OBSERVATION"
    || evidence.metadata?.methodology !== HYPERLIQUID_BTC_PERP_ORDER_BOOK_DURABLE_METHODOLOGY
  ) return null;

  try {
    const parsed = JSON.parse(evidence.content) as Partial<DurableHyperliquidPerpOrderBookPayload>;
    if (parsed.version !== "v1" || !parsed.snapshot) return null;
    assertHyperliquidSnapshot(parsed.snapshot);
    if (hyperliquidEvidenceId(parsed.snapshot) !== evidence.id) return null;
    if (parsed.snapshot.observedAt !== evidence.releasedAt) return null;
    if (evidence.metadata?.observationEffectiveAt !== parsed.snapshot.observedAt) return null;
    return parsed.snapshot;
  } catch {
    return null;
  }
}
