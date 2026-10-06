import assert from "node:assert/strict";
import test from "node:test";
import type { NewsItem } from "../data/types";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import { gdeltGalSnapshotsToEvidence } from "./gdelt-gal-history";
import {
  buildCatalystWireReadModel,
  officialSourceLabel,
} from "./catalyst-wire";

const AS_OF = "2026-10-04T15:00:00.000Z";

function media(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "media-1",
    category: "CRYPTO",
    source: "CoinDesk",
    publishedAt: "2026-10-04T14:45:00.000Z",
    title: "SEC updates bitcoin ETF rule",
    summary: "summary",
    url: "https://www.coindesk.com/example",
    ...overrides,
  };
}

function snapshot(overrides: Partial<GdeltGalFeedSnapshot> = {}): GdeltGalFeedSnapshot {
  return {
    asset: "BTC",
    feedLastBuildAt: "2026-10-04T14:47:00.000Z",
    feedWindowStartAt: "2026-10-04T14:32:00.000Z",
    coverage: "ROLLING_15_MINUTES",
    totalFeedItems: 10,
    invalidItemCount: 0,
    matchingCandidateCount: 1,
    candidateCoverage: "COMPLETE",
    candidates: [{
      asset: "BTC",
      url: "https://www.sec.gov/newsroom/example",
      title: "SEC updates bitcoin ETF rule",
      domain: "www.sec.gov",
      providerDate: "2026-10-04T14:46:00.000Z",
      providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN",
    }],
    ...overrides,
  };
}

test("recognizes only bounded official origin domains as primary sources", () => {
  assert.equal(officialSourceLabel("https://www.federalreserve.gov/newsevents/pressreleases/example.htm"), "Federal Reserve");
  assert.equal(officialSourceLabel("https://www.sec.gov/newsroom/example"), "SEC");
  assert.equal(officialSourceLabel("https://news.example.com/sec.gov/story"), null);
});

test("official-origin discovery wins duplicate media headline without changing timestamp semantics", () => {
  const evidence = gdeltGalSnapshotsToEvidence({
    snapshots: [snapshot()],
    retrievedAt: "2026-10-04T14:47:30.000Z",
  });
  const result = buildCatalystWireReadModel({
    macroNews: [],
    cryptoNews: [media()],
    gdeltEvidence: evidence,
    asOf: AS_OF,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.sourceRole, "PRIMARY");
  assert.equal(result.items[0]?.sourceLabel, "SEC · via GDELT");
  assert.equal(result.items[0]?.timeBasis, "SOURCE_OR_FIRST_SEEN");
  assert.equal(result.items[0]?.displayAt, "2026-10-04T14:46:00.000Z");
  assert.equal(result.discoveryStatus, "CURRENT");
});

test("missing GDELT provider date uses P365 discovery time instead of inventing publication time", () => {
  const noDate = snapshot({
    candidates: [{
      asset: "BTC",
      url: "https://example.com/bitcoin-story",
      title: "Bitcoin story",
      domain: "example.com",
      providerDate: null,
      providerDateSemantics: "UNAVAILABLE",
    }],
  });
  const evidence = gdeltGalSnapshotsToEvidence({
    snapshots: [noDate],
    retrievedAt: "2026-10-04T14:48:30.000Z",
  });
  const result = buildCatalystWireReadModel({
    macroNews: [],
    cryptoNews: [],
    gdeltEvidence: evidence,
    asOf: AS_OF,
  });

  assert.equal(result.items[0]?.sourceRole, "DISCOVERY");
  assert.equal(result.items[0]?.timeBasis, "DISCOVERED");
  assert.equal(result.items[0]?.displayAt, "2026-10-04T14:48:30.000Z");
});

test("only the latest durable GDELT snapshot per asset feeds the current wire", () => {
  const older = snapshot({
    feedLastBuildAt: "2026-10-04T14:32:00.000Z",
    feedWindowStartAt: "2026-10-04T14:17:00.000Z",
  });
  const latest = snapshot({
    feedLastBuildAt: "2026-10-04T14:47:00.000Z",
    feedWindowStartAt: "2026-10-04T14:32:00.000Z",
    matchingCandidateCount: 0,
    candidates: [],
  });
  const evidence = [
    ...gdeltGalSnapshotsToEvidence({
      snapshots: [older],
      retrievedAt: "2026-10-04T14:32:30.000Z",
    }),
    ...gdeltGalSnapshotsToEvidence({
      snapshots: [latest],
      retrievedAt: "2026-10-04T14:47:30.000Z",
    }),
  ];
  const result = buildCatalystWireReadModel({
    macroNews: [],
    cryptoNews: [],
    gdeltEvidence: evidence,
    asOf: AS_OF,
  });

  assert.equal(result.items.length, 0);
  assert.equal(result.discoveryFeedAt, "2026-10-04T14:47:00.000Z");
  assert.equal(result.discoveryStatus, "CURRENT");
});

test("stale durable discovery feed fails closed instead of replaying old headlines", () => {
  const evidence = gdeltGalSnapshotsToEvidence({
    snapshots: [snapshot({
      feedLastBuildAt: "2026-10-04T13:00:00.000Z",
      feedWindowStartAt: "2026-10-04T12:45:00.000Z",
    })],
    retrievedAt: "2026-10-04T13:00:30.000Z",
  });
  const result = buildCatalystWireReadModel({
    macroNews: [],
    cryptoNews: [],
    gdeltEvidence: evidence,
    asOf: AS_OF,
  });

  assert.equal(result.items.length, 0);
  assert.equal(result.discoveryStatus, "STALE");
});

test("title screening happens before the display limit and leaves raw Evidence intact", () => {
  const promo = "BTC News: Bitcoin Leaves Bear Market as Apeing's 1,566% Potential ROI Ending in 24 Hours - Best Crypto to Invest In";
  const input = snapshot({
    matchingCandidateCount: 2,
    candidates: [
      { ...snapshot().candidates[0], title: promo, url: "https://openpr.com/promo" },
      { ...snapshot().candidates[0], title: "Bitcoin ETF inflows increase", url: "https://example.com/bitcoin-etf" },
    ],
  });
  const evidence = gdeltGalSnapshotsToEvidence({ snapshots: [input], retrievedAt: "2026-10-04T14:47:30.000Z" });
  const original = JSON.stringify(evidence);
  const wire = buildCatalystWireReadModel({ macroNews: [], cryptoNews: [], gdeltEvidence: evidence, asOf: AS_OF, limit: 1 });
  assert.deepEqual(wire.items.map(item => item.title), ["Bitcoin ETF inflows increase"]);
  assert.equal(wire.excludedTitleCount, 1);
  assert.equal(wire.discoveryStatus, "CURRENT");
  assert.equal(JSON.stringify(evidence), original);
  assert.equal(JSON.parse(evidence[0].content).snapshot.candidates.length, 2);
});

test("an all-screened feed stays CURRENT and does not imply no raw candidates", () => {
  const evidence = gdeltGalSnapshotsToEvidence({ snapshots: [snapshot({ candidates: [
    { ...snapshot().candidates[0], title: "Best crypto to invest in", url: "https://example.com/promo" },
  ] })], retrievedAt: "2026-10-04T14:47:30.000Z" });
  const wire = buildCatalystWireReadModel({ macroNews: [], cryptoNews: [], gdeltEvidence: evidence, asOf: AS_OF });
  assert.equal(wire.items.length, 0);
  assert.equal(wire.excludedTitleCount, 1);
  assert.equal(wire.discoveryStatus, "CURRENT");
  assert.equal(wire.discoveryFeedAt, "2026-10-04T14:47:00.000Z");
});

test("screened counts follow cutoff and dedupe rather than counting future or duplicate titles", () => {
  const promo = "Best crypto to buy";
  const wire = buildCatalystWireReadModel({ macroNews: [], cryptoNews: [
    media({ title: promo }),
    media({ id: "duplicate", title: promo, url: "https://other.example/promo" }),
    media({ id: "future", title: "Join the token presale", url: "https://example.com/future", publishedAt: "2026-10-04T15:01:00.000Z" }),
    media({ id: "report", title: "SEC warns about token presale fraud", url: "https://www.sec.gov/warning" }),
  ], gdeltEvidence: [], asOf: AS_OF });
  assert.equal(wire.excludedTitleCount, 1);
  assert.deepEqual(wire.items.map(item => item.title), ["SEC warns about token presale fraud"]);
  assert.equal(wire.primaryItemCount, 1);
});
