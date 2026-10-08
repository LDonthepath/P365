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
    observationRefs: refs.map((observationId) => ({
      key: observationId,
      observationId,
      evidenceId: "evidence-" + observationId,
      sourceId: "fixture",
      quality: "FRESH" as const,
    })),
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
  } satisfies MarketSnapshot;
}

function observation(id: string, value: number, seriesKey: string): Observation {
  return {
    id,
    domain: "ASSET",
    subject: seriesKey,
    value: String(value),
    observedAt: "2026-09-25T12:30:00.000Z",
    retrievedAt: "2026-09-25T12:35:00.000Z",
    sourceId: "fixture",
    quality: "FRESH",
    evidenceId: "evidence-" + id,
    identity: {
      version: "v1",
      seriesKey,
      measurementId: "measurement-" + id,
      revisionFingerprint: "revision-" + id,
    },
  };
}

test("builds deterministic factual PRE to post move samples without selecting thresholds", async () => {
  const observations = new Map<string, Observation>([
    ["btc-pre", observation("btc-pre", 100, "btc.spot.usd")],
    ["btc-post", observation("btc-post", 101, "btc.spot.usd")],
    ["dxy-pre", observation("dxy-pre", 100, "dxy.index.usd")],
    ["dxy-post", observation("dxy-post", 99.5, "dxy.index.usd")],
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
  const btcObservation = observation("btc", 100, "btc.spot.usd");
  const repository = {
    save: async () => {},
    saveMany: async () => {},
    findById: async () => btcObservation,
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
