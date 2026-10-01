import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "./memory";

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

test("batch Observation lookup deduplicates IDs, ignores missing rows, and preserves request order", async () => {
  const repository = new InMemoryObservationRepository();
  await repository.saveMany([
    observation("obs-a"),
    observation("obs-b"),
    observation("obs-c"),
  ]);

  const result = await repository.findManyByIds([
    "obs-c",
    "obs-a",
    "obs-c",
    "missing",
    "obs-b",
  ]);

  assert.deepEqual(result.map((item) => item.id), ["obs-c", "obs-a", "obs-b"]);
});
