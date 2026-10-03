import assert from "node:assert/strict";
import test from "node:test";
import { providerResult } from "../data/types";
import { buildMoveNewsCatalystEvidence } from "./move-news-catalyst";

test("move-news evidence keeps GDELT GAL candidates non-causal and current-only", () => {
  const result = providerResult("gdelt", "SUCCESS", [{
    asset: "BTC" as const,
    feedLastBuildAt: "2026-10-04T11:59:00.000Z",
    feedWindowStartAt: "2026-10-04T11:44:00.000Z",
    coverage: "ROLLING_15_MINUTES" as const,
    totalFeedItems: 100,
    candidates: [{
      asset: "BTC" as const,
      url: "https://example.com/story",
      title: "Bitcoin moves after announcement",
      domain: "example.com",
      providerDate: "2026-10-04T11:58:00.000Z",
      providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN" as const,
    }],
  }], undefined, undefined, "2026-10-04T12:00:00.000Z");

  const evidence = buildMoveNewsCatalystEvidence({ asset: "BTC", result });
  assert.equal(evidence.state, "CANDIDATES_AVAILABLE");
  assert.equal(evidence.coverage, "ROLLING_15_MINUTES");
  assert.equal(evidence.causalAttribution, "NOT_EVALUATED");
  assert.equal(evidence.historicalPointInTimeReplay, "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION");
  assert.equal(evidence.candidates.length, 1);
});

test("move-news evidence distinguishes provider failure", () => {
  const evidence = buildMoveNewsCatalystEvidence({
    asset: "GOLD",
    result: providerResult("gdelt", "ERROR", [], "GDELT GAL HTTP 503", undefined, "2026-10-04T12:00:00Z"),
  });
  assert.equal(evidence.state, "PROVIDER_UNAVAILABLE");
  assert.equal(evidence.coverage, "UNAVAILABLE");
});
