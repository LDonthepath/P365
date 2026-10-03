import assert from "node:assert/strict";
import test from "node:test";
import { providerResult } from "../data/types";
import { buildMoveNewsCatalystEvidence } from "./move-news-catalyst";

test("move-news evidence preserves candidates as non-causal and marks replay unsupported", () => {
  const result = providerResult("gdelt", "SUCCESS", [{
    asset: "BTC" as const,
    url: "https://example.com/story",
    title: "Unexpected announcement",
    domain: "example.com",
    language: "English",
    sourceCountry: "United States",
    providerDate: "2026-10-04T10:15:00.000Z",
    providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN" as const,
    query: '("bitcoin" OR "BTC")',
  }], undefined, undefined, "2026-10-04T10:20:00.000Z");

  const evidence = buildMoveNewsCatalystEvidence({
    asset: "BTC",
    windowStart: "2026-10-04T10:00:00.000Z",
    windowEnd: "2026-10-04T10:30:00.000Z",
    result,
  });

  assert.equal(evidence.state, "CANDIDATES_AVAILABLE");
  assert.equal(evidence.causalAttribution, "NOT_EVALUATED");
  assert.equal(evidence.historicalPointInTimeReplay, "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION");
  assert.equal(evidence.candidates.length, 1);
});

test("move-news evidence distinguishes no candidates from provider failure", () => {
  const empty = buildMoveNewsCatalystEvidence({
    asset: "GOLD",
    windowStart: "2026-10-04T10:00:00Z",
    windowEnd: "2026-10-04T10:30:00Z",
    result: providerResult("gdelt", "EMPTY", [], undefined, undefined, "2026-10-04T10:31:00Z"),
  });
  assert.equal(empty.state, "NO_CANDIDATES");

  const failed = buildMoveNewsCatalystEvidence({
    asset: "GOLD",
    windowStart: "2026-10-04T10:00:00Z",
    windowEnd: "2026-10-04T10:30:00Z",
    result: providerResult("gdelt", "ERROR", [], "GDELT HTTP 429", undefined, "2026-10-04T10:31:00Z"),
  });
  assert.equal(failed.state, "PROVIDER_UNAVAILABLE");
});
