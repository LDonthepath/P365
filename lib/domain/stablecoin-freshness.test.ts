import assert from "node:assert/strict";
import test from "node:test";
import { qualityFromDailyUtcCadence } from "./freshness";

test("qualifies daily 24/7 stablecoin freshness by UTC calendar cadence", () => {
  assert.equal(qualityFromDailyUtcCadence({
    observedAt: "2026-09-29T00:00:00.000Z",
    evaluatedAt: "2026-09-29T23:59:59.999Z",
  }), "FRESH", "same UTC provider date is current");
  assert.equal(qualityFromDailyUtcCadence({
    observedAt: "2026-09-28T00:00:00.000Z",
    evaluatedAt: "2026-09-29T23:59:59.999Z",
  }), "FRESH", "immediately previous UTC provider date is current");
  assert.equal(qualityFromDailyUtcCadence({
    observedAt: "2026-09-27T23:59:59.999Z",
    evaluatedAt: "2026-09-29T00:00:00.000Z",
  }), "STALE", "older than the previous UTC provider date is stale");
  assert.equal(qualityFromDailyUtcCadence({
    observedAt: "2026-09-29T12:00:00.001Z",
    evaluatedAt: "2026-09-29T12:00:00.000Z",
  }), "UNKNOWN", "future timestamp is unknown even on the same UTC date");
  assert.equal(qualityFromDailyUtcCadence({
    observedAt: "invalid",
    evaluatedAt: "2026-09-29T12:00:00.000Z",
  }), "UNKNOWN", "invalid timestamp is unknown");
});
