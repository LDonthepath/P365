import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import type { ObservationRepository } from "../repositories/types";
import { resolveIntradayObservations } from "./intraday-event-monitor";

function observation(id: string): Observation {
  return {
    id,
    domain: "MARKET",
    subject: id,
    value: "1",
    observedAt: "2026-09-30T12:30:00.000Z",
    retrievedAt: "2026-09-30T12:31:00.000Z",
    sourceId: "test",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: { metricId: id },
  };
}

test("intraday resolution uses one batch call when repository supports it", async () => {
  let batchCalls = 0;
  let singleCalls = 0;
  const repository: ObservationRepository = {
    async save() {},
    async saveMany() {},
    async findById() {
      singleCalls += 1;
      throw new Error("single lookup must not be used when batch lookup exists");
    },
    async findManyByIds(ids) {
      batchCalls += 1;
      assert.deepEqual(ids, ["obs-a", "obs-b", "missing"]);
      return [observation("obs-a"), observation("obs-b")];
    },
  };

  const result = await resolveIntradayObservations(repository, [
    "obs-a",
    "obs-b",
    "obs-a",
    "missing",
  ]);

  assert.equal(batchCalls, 1);
  assert.equal(singleCalls, 0);
  assert.deepEqual([...result.keys()], ["obs-a", "obs-b"]);
});

test("intraday resolution keeps the compatible findById fallback", async () => {
  let singleCalls = 0;
  const rows = new Map([
    ["obs-a", observation("obs-a")],
    ["obs-b", observation("obs-b")],
  ]);
  const repository: ObservationRepository = {
    async save() {},
    async saveMany() {},
    async findById(id) {
      singleCalls += 1;
      return rows.get(id) ?? null;
    },
  };

  const result = await resolveIntradayObservations(repository, [
    "obs-b",
    "missing",
    "obs-b",
    "obs-a",
  ]);

  assert.equal(singleCalls, 3, "duplicate IDs are resolved once even on fallback");
  assert.deepEqual([...result.keys()], ["obs-b", "obs-a"]);
});
