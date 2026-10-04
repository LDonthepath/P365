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
