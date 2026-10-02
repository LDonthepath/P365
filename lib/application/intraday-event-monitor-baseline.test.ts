import assert from "node:assert/strict";
import test from "node:test";
import type { EconomicEventResult } from "../domain/event-result";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Observation } from "../domain/types";
import { resolveIntradayBaselineEvidence } from "./intraday-event-monitor";

function observation(id: string, seriesKey: string, value: string, unit: string): Observation {
  return {
    id,
    domain: "ASSET",
    subject: seriesKey,
    value,
    observedAt: "2026-10-02T12:24:00.000Z",
    retrievedAt: "2026-10-02T12:24:30.000Z",
    sourceId: seriesKey.startsWith("btc") ? "coingecko-market" : "yahoo-finance",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    identity: { seriesKey, measurementId: `measurement-${id}`, revisionId: `revision-${id}` },
    metadata: { metricId: seriesKey, unit },
  };
}

const pre: MarketSnapshot = {
  id: "snapshot-pre",
  version: "v1",
  capturedAt: "2026-10-02T12:25:00.000Z",
  scope: "event-window",
  observationRefs: [
    { key: "ASSET:btc.spot.usd:coingecko-market", observationId: "btc", evidenceId: "evidence-btc", sourceId: "coingecko-market", quality: "FRESH" },
    { key: "ASSET:dxy.index.usd:yahoo-finance", observationId: "dxy", evidenceId: "evidence-dxy", sourceId: "yahoo-finance", quality: "FRESH" },
  ],
  eventRefs: [],
  baselineRefs: [
    {
      key: "EXPECTATION:event:v1:US:test:biquote-economic-event:FORECAST",
      kind: "EXPECTATION",
      status: "VALID",
      policy: "latest-qualified-pre-release-v1",
      observationIds: [],
      eventResultIds: ["result-forecast"],
      evidenceIds: ["evidence-forecast"],
    },
    {
      key: "PRICING:btc.spot.usd:coingecko-market",
      kind: "PRICING",
      status: "VALID",
      policy: "latest-qualified-pricing-as-of-v1",
      observationIds: ["btc"],
      eventResultIds: [],
      evidenceIds: ["evidence-btc"],
    },
    {
      key: "PRICING:dxy.index.usd:yahoo-finance",
      kind: "PRICING",
      status: "VALID",
      policy: "latest-qualified-pricing-as-of-v1",
      observationIds: ["dxy"],
      eventResultIds: [],
      evidenceIds: ["evidence-dxy"],
    },
  ],
  stateRefs: [],
  sourceHealthRefs: [],
  requirements: [{ kind: "EVENT", key: "event:v1:US:test" }],
  missingRequirements: [],
  quality: "COMPLETE",
};

const result: EconomicEventResult = {
  id: "result-forecast",
  eventId: "event-a",
  eventIdentityKey: "event:v1:US:test",
  expected: 220,
  expectedType: "FORECAST",
  unit: "K",
  period: "2026-W40",
  retrievedAt: "2026-10-02T11:00:00.000Z",
  sourceId: "biquote-economic-event",
  evidenceId: "evidence-forecast",
};

test("resolves expectation and pricing lineage only from the frozen PRE snapshot", () => {
  const observations = new Map<string, Observation>([
    ["btc", observation("btc", "btc.spot.usd", "85000", "USD")],
    ["dxy", observation("dxy", "dxy.index.usd", "102.1", "Index")],
  ]);

  const evidence = resolveIntradayBaselineEvidence(pre, observations, [result]);

  assert.equal(evidence.snapshotId, "snapshot-pre");
  assert.equal(evidence.expectation?.status, "VALID");
  assert.equal(evidence.expectation?.expected, 220);
  assert.equal(evidence.expectation?.expectedType, "FORECAST");
  assert.deepEqual(
    evidence.pricing.map((item) => [item.seriesKey, item.value, item.status]),
    [
      ["btc.spot.usd", 85000, "VALID"],
      ["dxy.index.usd", 102.1, "VALID"],
    ],
  );
});
