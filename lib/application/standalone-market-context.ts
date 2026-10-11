import type { Evidence } from "../domain/types";
import { btcSpotFlowWindowFromEvidence } from "./btc-spot-flow-history";
import { gdeltGalSnapshotFromEvidence } from "./gdelt-gal-history";

/**
 * MARKET-CONTEXT-001: a factual, trigger-independent view of already persisted
 * venue spot flow and GDELT discovery snapshots. This is not a MOVE verdict,
 * a causal attribution, or a cross-market flow estimate.
 */
export type MarketContextStatus = "CURRENT" | "PARTIAL" | "STALE" | "EMPTY" | "UNAVAILABLE" | "UNKNOWN";

export type VenueFlowContext = {
  source: "Binance Spot";
  market: "BTCUSDT";
  asOf: string;
  status: MarketContextStatus;
  coverage: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  expectedWindows: 3;
  observedWindows: number;
  observedAt: string | null;
  windowStartAt: string | null;
  retrievedAt: string | null;
  netTakerBaseVolumeBtc: number | null;
  takerBuyBaseVolumeBtc: number | null;
  takerSellBaseVolumeBtc: number | null;
  tradeCount: number | null;
  reason: string;
};

export type GdeltMarketContext = {
  asset: "BTC" | "GOLD";
  source: "GDELT GAL";
  status: MarketContextStatus;
  feedWindowStartAt: string | null;
  feedLastBuildAt: string | null;
  retrievedAt: string | null;
  matchingCandidates: number | null;
  displayedCandidates: number | null;
  totalFeedItems: number | null;
  invalidItemCount: number | null;
  candidateCoverage: "COMPLETE" | "TRUNCATED" | "UNKNOWN";
  reason: string;
};

export type StandaloneMarketContextReadModel = {
  asOf: string;
  flow: VenueFlowContext;
  discovery: [GdeltMarketContext, GdeltMarketContext];
  causalAttribution: "NOT_EVALUATED";
};

const FIVE_MINUTES_MS = 5 * 60_000;
const FLOW_MAX_AGE_MS = 10 * 60_000;
const NEWS_MAX_AGE_MS = 30 * 60_000;

function eligible(evidence: Evidence, asOfMs: number): boolean {
  const retrievedAtMs = Date.parse(evidence.retrievedAt);
  return Number.isFinite(retrievedAtMs) && retrievedAtMs <= asOfMs;
}

function buildFlow(
  evidence: readonly Evidence[],
  asOf: string,
  readSucceeded: boolean,
): VenueFlowContext {
  const base: VenueFlowContext = {
    source: "Binance Spot",
    market: "BTCUSDT",
    asOf,
    status: readSucceeded ? "UNAVAILABLE" : "UNKNOWN",
    coverage: "UNKNOWN",
    expectedWindows: 3,
    observedWindows: 0,
    observedAt: null,
    windowStartAt: null,
    retrievedAt: null,
    netTakerBaseVolumeBtc: null,
    takerBuyBaseVolumeBtc: null,
    takerSellBaseVolumeBtc: null,
    tradeCount: null,
    reason: readSucceeded
      ? "Belum ada bukti durable untuk rentang ini; aktivitas pasar tidak dapat disimpulkan."
      : "Riwayat durable Binance tidak berhasil dibaca.",
  };
  if (!readSucceeded) return base;

  const valid = evidence.flatMap((item) => {
    if (!eligible(item, Date.parse(asOf))) return [];
    const window = btcSpotFlowWindowFromEvidence(item);
    if (!window) return [];
    const endMs = Date.parse(window.observedAt);
    if (!Number.isFinite(endMs) || endMs > Date.parse(asOf)) return [];
    return [{ window, evidence: item, endMs }];
  }).sort((a, b) => b.endMs - a.endMs || Date.parse(b.evidence.retrievedAt) - Date.parse(a.evidence.retrievedAt));

  // A revision or repeated retrieval is not another completed 5m window.
  const byEnd = new Map<number, (typeof valid)[number]>();
  for (const item of valid) if (!byEnd.has(item.endMs)) byEnd.set(item.endMs, item);
  const latest = [...byEnd.values()][0];
  if (!latest) return base;

  const observedWindows = [0, 1, 2].filter((step) =>
    byEnd.has(latest.endMs - step * FIVE_MINUTES_MS)).length;
  const coverage = observedWindows === 3 ? "COMPLETE" : "PARTIAL";
  const age = Date.parse(asOf) - latest.endMs;
  const status: MarketContextStatus = age > FLOW_MAX_AGE_MS
    ? "STALE"
    : coverage === "COMPLETE" ? "CURRENT" : "PARTIAL";

  return {
    ...base,
    status,
    coverage,
    observedWindows,
    observedAt: latest.window.observedAt,
    windowStartAt: new Date(latest.window.providerIntervalStartMs).toISOString(),
    retrievedAt: latest.evidence.retrievedAt,
    netTakerBaseVolumeBtc: latest.window.netTakerBaseVolumeBtc,
    takerBuyBaseVolumeBtc: latest.window.takerBuyBaseVolumeBtc,
    takerSellBaseVolumeBtc: latest.window.takerSellBaseVolumeBtc,
    tradeCount: latest.window.tradeCount,
    reason: status === "STALE"
      ? "Interval terbaru sudah terlalu lama; angka berikut adalah fakta historis, bukan kondisi terkini."
      : coverage === "PARTIAL"
        ? "Tidak seluruh tiga interval 5-menit berturutan tersedia; angka hanya untuk interval terakhir."
        : "Tiga interval 5-menit berurutan ditemukan; angka transaksi ditampilkan untuk interval terakhir saja.",
  };
}

function buildDiscovery(
  asset: "BTC" | "GOLD",
  evidence: readonly Evidence[],
  asOf: string,
  readSucceeded: boolean,
): GdeltMarketContext {
  const base: GdeltMarketContext = {
    asset,
    source: "GDELT GAL",
    status: readSucceeded ? "UNAVAILABLE" : "UNKNOWN",
    feedWindowStartAt: null,
    feedLastBuildAt: null,
    retrievedAt: null,
    matchingCandidates: null,
    displayedCandidates: null,
    totalFeedItems: null,
    invalidItemCount: null,
    candidateCoverage: "UNKNOWN",
    reason: readSucceeded
      ? "Belum ada snapshot durable pada rentang yang dibaca; tidak berarti tidak ada berita."
      : "Riwayat GDELT tidak berhasil dibaca.",
  };
  if (!readSucceeded) return base;

  const found = evidence.flatMap((item) => {
    if (!eligible(item, Date.parse(asOf))) return [];
    const snapshot = gdeltGalSnapshotFromEvidence(item);
    if (!snapshot || snapshot.asset !== asset) return [];
    const time = Date.parse(snapshot.feedLastBuildAt);
    if (!Number.isFinite(time) || time > Date.parse(asOf)) return [];
    return [{ item, snapshot, time }];
  }).sort((a, b) => b.time - a.time || Date.parse(b.item.retrievedAt) - Date.parse(a.item.retrievedAt))[0];
  if (!found) return base;

  const age = Date.parse(asOf) - found.time;
  const incomplete = found.snapshot.candidateCoverage !== "COMPLETE" || found.snapshot.invalidItemCount > 0;
  const status: MarketContextStatus = age > NEWS_MAX_AGE_MS
    ? "STALE"
    : incomplete
      ? "PARTIAL"
      : found.snapshot.matchingCandidateCount === 0 ? "EMPTY" : "CURRENT";

  return {
    ...base,
    status,
    feedWindowStartAt: found.snapshot.feedWindowStartAt,
    feedLastBuildAt: found.snapshot.feedLastBuildAt,
    retrievedAt: found.item.retrievedAt,
    matchingCandidates: found.snapshot.matchingCandidateCount,
    displayedCandidates: found.snapshot.candidates.length,
    totalFeedItems: found.snapshot.totalFeedItems,
    invalidItemCount: found.snapshot.invalidItemCount,
    candidateCoverage: found.snapshot.candidateCoverage,
    reason: status === "STALE"
      ? "Snapshot feed telah lewat 30 menit; tidak digunakan untuk menyimpulkan keadaan berita terkini."
      : status === "PARTIAL"
        ? "Cakupan kandidat tidak lengkap atau sebagian item feed tidak valid."
        : status === "EMPTY"
          ? "Tidak ditemukan kandidat dalam snapshot 15-menit yang teramati; bukan bukti tidak ada berita."
          : "Kandidat berita adalah hasil pencarian feed, bukan penyebab pergerakan atau konfirmasi peristiwa.",
  };
}

export function buildStandaloneMarketContextReadModel(input: {
  asOf: string;
  binanceEvidence: readonly Evidence[];
  gdeltEvidence: readonly Evidence[];
  binanceReadSucceeded?: boolean;
  gdeltReadSucceeded?: boolean;
}): StandaloneMarketContextReadModel {
  if (!Number.isFinite(Date.parse(input.asOf))) {
    throw new Error("Standalone market context requires valid asOf.");
  }
  return {
    asOf: input.asOf,
    flow: buildFlow(input.binanceEvidence, input.asOf, input.binanceReadSucceeded ?? true),
    discovery: [
      buildDiscovery("BTC", input.gdeltEvidence, input.asOf, input.gdeltReadSucceeded ?? true),
      buildDiscovery("GOLD", input.gdeltEvidence, input.asOf, input.gdeltReadSucceeded ?? true),
    ],
    causalAttribution: "NOT_EVALUATED",
  };
}
