import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BtcSpotFlowWindow } from "./btc-spot-flow";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import { BTC_SPOT_FLOW_METHODOLOGY } from "./btc-spot-flow";
import { btcSpotFlowWindowsToEvidence } from "./btc-spot-flow-history";
import { gdeltGalSnapshotsToEvidence } from "./gdelt-gal-history";
import { buildStandaloneMarketContextReadModel } from "./standalone-market-context";
import { StandaloneMarketContextPanel } from "../../app/dashboard/standalone-market-context-panel";

const AS_OF = "2026-10-11T12:00:00.000Z";

function flow(observedAt: string, net = 4): BtcSpotFlowWindow {
  const end = Date.parse(observedAt);
  const total = 12;
  const buy = (total + net) / 2;
  const sell = (total - net) / 2;
  return {
    asset: "BTC", venue: "BINANCE", pair: "BTCUSDT", baseUnit: "BTC",
    providerIntervalStartMs: end - 300_000, observedAt,
    windowSeconds: 300, totalBaseVolumeBtc: total,
    takerBuyBaseVolumeBtc: buy, takerSellBaseVolumeBtc: sell,
    netTakerBaseVolumeBtc: net, takerBuyShare: buy / total,
    tradeCount: 72, coverage: "COMPLETE", methodology: BTC_SPOT_FLOW_METHODOLOGY,
  };
}

function feed(
  asset: "BTC" | "GOLD",
  lastBuildAt: string,
  matchingCount = 0,
  overrides: Partial<GdeltGalFeedSnapshot> = {},
): GdeltGalFeedSnapshot {
  return {
    asset,
    feedLastBuildAt: lastBuildAt,
    feedWindowStartAt: new Date(Date.parse(lastBuildAt) - 900_000).toISOString(),
    coverage: "ROLLING_15_MINUTES",
    totalFeedItems: 20, invalidItemCount: 0,
    matchingCandidateCount: matchingCount,
    candidateCoverage: "COMPLETE",
    candidates: matchingCount === 0 ? [] : [{
      asset, title: asset + " related policy headline",
      domain: "example.com", url: "https://example.com/" + asset.toLowerCase(),
      providerDate: null, providerDateSemantics: "UNAVAILABLE",
    }],
    ...overrides,
  };
}

test("no MOVE trigger is needed: Binance + both GDELT assets render independent factual context", () => {
  const binanceEvidence = btcSpotFlowWindowsToEvidence({
    windows: [
      flow("2026-10-11T11:45:00.000Z"),
      flow("2026-10-11T11:50:00.000Z"),
      flow("2026-10-11T11:55:00.000Z", -2),
    ],
    retrievedAt: "2026-10-11T11:56:00.000Z",
  });
  const gdeltEvidence = gdeltGalSnapshotsToEvidence({
    snapshots: [
      feed("BTC", "2026-10-11T11:50:00.000Z"),
      feed("GOLD", "2026-10-11T11:50:00.000Z", 1),
    ],
    retrievedAt: "2026-10-11T11:51:00.000Z",
  });
  const before = JSON.stringify({ binanceEvidence, gdeltEvidence });
  const output = buildStandaloneMarketContextReadModel({asOf: AS_OF, binanceEvidence, gdeltEvidence});

  assert.equal(output.flow.status, "CURRENT");
  assert.equal(output.flow.coverage, "COMPLETE");
  assert.equal(output.flow.observedWindows, 3);
  assert.equal(output.flow.netTakerBaseVolumeBtc, -2);
  assert.equal(output.flow.observedAt, "2026-10-11T11:55:00.000Z");
  assert.equal(output.discovery[0].status, "EMPTY");
  assert.equal(output.discovery[0].matchingCandidates, 0);
  assert.equal(output.discovery[1].status, "CURRENT");
  assert.equal(output.discovery[1].matchingCandidates, 1);
  assert.equal(output.causalAttribution, "NOT_EVALUATED");
  assert.equal(JSON.stringify({ binanceEvidence, gdeltEvidence }), before);

  const html = renderToStaticMarkup(createElement(StandaloneMarketContextPanel, {data: output}));
  assert.match(html, /Apa yang teramati di pasar sekarang\?/);
  assert.match(html, /Binance BTCUSDT/);
  assert.match(html, /Kandidat berita BTC dan Emas/);
  assert.match(html, /TANPA KANDIDAT PADA SNAPSHOT/);
  assert.match(html, /tidak membuktikan penyebab/);
  assert.match(html, /Diambil P365/);
});

test("partial completed-flow history is shown as partial, never invented as three complete windows", () => {
  const evidence = btcSpotFlowWindowsToEvidence({
    windows: [
      flow("2026-10-11T11:45:00.000Z"),
      flow("2026-10-11T11:55:00.000Z"),
    ],
    retrievedAt: "2026-10-11T11:56:00.000Z",
  });
  const output = buildStandaloneMarketContextReadModel({asOf: AS_OF, binanceEvidence: evidence, gdeltEvidence: []});
  assert.equal(output.flow.status, "PARTIAL");
  assert.equal(output.flow.observedWindows, 2);
  assert.equal(output.flow.coverage, "PARTIAL");
  assert.match(output.flow.reason, /Tidak seluruh/);
  assert.equal(output.discovery[0].status, "UNAVAILABLE");
  assert.equal(output.discovery[1].status, "UNAVAILABLE");
});

test("stale feed snapshots remain labeled historical and do not masquerade as current", () => {
  const binanceEvidence = btcSpotFlowWindowsToEvidence({
    windows: [flow("2026-10-11T11:30:00.000Z")],
    retrievedAt: "2026-10-11T11:31:00.000Z",
  });
  const gdeltEvidence = gdeltGalSnapshotsToEvidence({
    snapshots: [feed("GOLD", "2026-10-11T10:55:00.000Z", 1)],
    retrievedAt: "2026-10-11T10:56:00.000Z",
  });
  const output = buildStandaloneMarketContextReadModel({asOf: AS_OF, binanceEvidence, gdeltEvidence});
  assert.equal(output.flow.status, "STALE");
  assert.equal(output.discovery[1].status, "STALE");
  assert.equal(output.discovery[1].matchingCandidates, 1);
  assert.match(output.discovery[1].reason, /lewat 30 menit/);
});

test("GDELT truncated or invalid feed is partial, not a definitive no-news assertion", () => {
  const gdeltEvidence = gdeltGalSnapshotsToEvidence({
    snapshots: [feed("BTC", "2026-10-11T11:50:00.000Z", 2, {
      candidateCoverage: "TRUNCATED", invalidItemCount: 2,
    })],
    retrievedAt: "2026-10-11T11:51:00.000Z",
  });
  const output = buildStandaloneMarketContextReadModel({asOf: AS_OF, binanceEvidence: [], gdeltEvidence});
  assert.equal(output.discovery[0].status, "PARTIAL");
  assert.equal(output.discovery[0].candidateCoverage, "TRUNCATED");
  assert.equal(output.discovery[0].matchingCandidates, 2);
});

test("strict asOf excludes future-retrieved and future-source evidence and cannot contaminate replay", () => {
  const tooLate = btcSpotFlowWindowsToEvidence({
    windows: [flow("2026-10-11T11:55:00.000Z")],
    retrievedAt: "2026-10-11T12:01:00.000Z",
  });
  const futureFeed = gdeltGalSnapshotsToEvidence({
    snapshots: [feed("BTC", "2026-10-11T12:05:00.000Z", 1)],
    retrievedAt: "2026-10-11T12:06:00.000Z",
  });
  const output = buildStandaloneMarketContextReadModel({asOf: AS_OF, binanceEvidence: tooLate, gdeltEvidence: futureFeed});
  assert.equal(output.flow.status, "UNAVAILABLE");
  assert.equal(output.discovery[0].status, "UNAVAILABLE");
  assert.equal(output.flow.netTakerBaseVolumeBtc, null);
});

test("read failure is UNKNOWN rather than false zero, malformed records fail closed", () => {
  const output = buildStandaloneMarketContextReadModel({
    asOf: AS_OF, binanceEvidence: [], gdeltEvidence: [],
    binanceReadSucceeded: false, gdeltReadSucceeded: false,
  });
  assert.equal(output.flow.status, "UNKNOWN");
  assert.equal(output.discovery[0].status, "UNKNOWN");
  assert.equal(output.discovery[1].status, "UNKNOWN");
  assert.equal(output.discovery[0].matchingCandidates, null);
  const bad = btcSpotFlowWindowsToEvidence({
    windows: [flow("2026-10-11T11:55:00.000Z")],
    retrievedAt: "2026-10-11T11:56:00.000Z",
  }).map(item => ({...item, content: "{invalid json"}));
  const ignored = buildStandaloneMarketContextReadModel({asOf: AS_OF, binanceEvidence: bad, gdeltEvidence: []});
  assert.equal(ignored.flow.status, "UNAVAILABLE");
  assert.throws(
    () => buildStandaloneMarketContextReadModel({asOf: "invalid", binanceEvidence: [], gdeltEvidence: []}),
    /valid asOf/,
  );
});
