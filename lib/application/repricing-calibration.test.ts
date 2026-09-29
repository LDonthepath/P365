import assert from "node:assert/strict";
import test from "node:test";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Observation } from "../domain/types";
import type { ObservationRepository } from "../repositories/types";
import { buildRepricingCalibrationDataset } from "./repricing-calibration";

function snapshot(id: string, role: string, capturedAt: string, refs: string[]): MarketSnapshot {
  return {
    id,
    version: "v1",
    capturedAt,
    scope: "EVENT_WINDOW",
    observationRefs: refs.map((observationId) => ({ observationId })),
    eventRefs: [],
    baselineRefs: [],
    stateRefs: [],
    sourceHealthRefs: [],
    requirements: [],
    missingRequirements: [],
    quality: "COMPLETE",
    metadata: {
      eventIdentityKey: "event:v1:US:2026-09-25T12:30:00.000Z:durable-goods-orders",
      eventWindowRole: role,
    },
  } as MarketSnapshot;
}

test("builds deterministic factual PRE to post move samples without selecting thresholds", async () => {
  const observations = new Map<string, Observation>([
    ["btc-pre", { id: "btc-pre", value: 100, identity: { seriesKey: "btc.spot.usd" } } as Observation],
    ["btc-post", { id: "btc-post", value: 101, identity: { seriesKey: "btc.spot.usd" } } as Observation],
    ["dxy-pre", { id: "dxy-pre", value: 100, identity: { seriesKey: "dxy.index.usd" } } as Observation],
    ["dxy-post", { id: "dxy-post", value: 99.5, identity: { seriesKey: "dxy.index.usd" } } as Observation],
  ]);
  const repository = {
    save: async () => {},
    saveMany: async () => {},
    findById: async (id: string) => observations.get(id) ?? null,
  } satisfies ObservationRepository;

  const result = await buildRepricingCalibrationDataset({
    snapshots: [
      snapshot("post", "T_PLUS_5", "2026-09-25T12:35:00.000Z", ["btc-post", "dxy-post"]),
      snapshot("pre", "PRE", "2026-09-25T12:25:00.000Z", ["btc-pre", "dxy-pre"]),
    ],
    observationRepository: repository,
  });

  assert.deepEqual(result.map((point) => ({
    role: point.afterRole,
    key: point.observationKey,
    absoluteDelta: point.absoluteDelta,
    percentDelta: point.percentDelta,
  })), [
    { role: "T_PLUS_5", key: "btc.spot.usd", absoluteDelta: 1, percentDelta: 1 },
    { role: "T_PLUS_5", key: "dxy.index.usd", absoluteDelta: -0.5, percentDelta: -0.5 },
  ]);
});

test("keeps snapshot quality explicit instead of silently qualifying calibration evidence", async () => {
  const observation = { id: "btc", value: 100, identity: { seriesKey: "btc.spot.usd" } } as Observation;
  const repository = {
    save: async () => {},
    saveMany: async () => {},
    findById: async () => observation,
  } satisfies ObservationRepository;
  const pre = snapshot("pre", "PRE", "2026-09-25T12:25:00.000Z", ["btc"]);
  pre.quality = "PARTIAL";
  const post = snapshot("post", "T_PLUS_5", "2026-09-25T12:35:00.000Z", ["btc"]);

  const [point] = await buildRepricingCalibrationDataset({
    snapshots: [pre, post],
    observationRepository: repository,
  });

  assert.equal(point.beforeQuality, "PARTIAL");
  assert.equal(point.afterQuality, "COMPLETE");
});
