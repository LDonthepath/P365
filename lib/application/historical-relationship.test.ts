import assert from "node:assert/strict";
import test from "node:test";
import { measureRepositoryBackedHistoricalRelationship } from "./historical-relationship";
import type { Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

const observation = (id: string, seriesKey: string, observedAt: string, retrievedAt: string, value: string): Observation => ({
  id, domain: "MARKET", subject: seriesKey, value, observedAt, retrievedAt,
  sourceId: "test", quality: "FRESH", evidenceId: "e-" + id,
  identity: { version: "v1", seriesKey, measurementId: "m-" + id, revisionFingerprint: "r-" + id },
});

class MemoryHistory implements HistoricalObservationRepository {
  constructor(private readonly rows: Observation[]) {}
  async findHistory(query: Parameters<HistoricalObservationRepository["findHistory"]>[0]): Promise<Observation[]> {
    return this.rows.filter((o) =>
      o.domain === query.identity.domain
      && o.identity?.seriesKey === query.identity.seriesKey
      && (!query.retrievedAtOnOrBefore || o.retrievedAt <= query.retrievedAtOnOrBefore)
      && (!query.observedAtOnOrAfter || o.observedAt >= query.observedAtOnOrAfter)
      && (!query.observedAtOnOrBefore || o.observedAt <= query.observedAtOnOrBefore));
  }
}

const methodology = {
  methodologyId: "rel-test",
  methodologyVersion: "v1",
  left: { domain: "MARKET" as const, seriesKey: "left" },
  right: { domain: "MARKET" as const, seriesKey: "right" },
  transformation: "LEVEL" as const,
  observedAtOnOrAfter: "2026-01-01T00:00:00.000Z",
  observedAtOnOrBefore: "2026-01-03T00:00:00.000Z",
  asOf: "2026-01-03T12:00:00.000Z",
  minimumSampleSize: 3,
};

test("REL-001 measures exact-time paired observations and excludes later-known revision", async () => {
  const repo = new MemoryHistory([
    observation("l1","left","2026-01-01T00:00:00.000Z","2026-01-01T01:00:00.000Z","1"),
    observation("l2","left","2026-01-02T00:00:00.000Z","2026-01-02T01:00:00.000Z","2"),
    observation("l3","left","2026-01-03T00:00:00.000Z","2026-01-03T01:00:00.000Z","3"),
    observation("l3-late","left","2026-01-03T00:00:00.000Z","2026-01-04T01:00:00.000Z","300"),
    observation("r1","right","2026-01-01T00:00:00.000Z","2026-01-01T01:00:00.000Z","2"),
    observation("r2","right","2026-01-02T00:00:00.000Z","2026-01-02T01:00:00.000Z","4"),
    observation("r3","right","2026-01-03T00:00:00.000Z","2026-01-03T01:00:00.000Z","6"),
  ]);
  const result = await measureRepositoryBackedHistoricalRelationship({ methodology, repository: repo });
  assert.equal(result.status, "VALID");
  assert.equal(result.sampleSize, 3);
  assert.equal(result.correlation, 1);
  assert.equal(result.points[2].leftObservationId, "l3");
  assert.equal(result.causalAttribution, "NOT_EVALUATED");
});

test("REL-001 CHANGE uses paired consecutive changes and fails closed below minimum sample", async () => {
  const repo = new MemoryHistory([
    observation("l1","left","2026-01-01T00:00:00.000Z","2026-01-01T01:00:00.000Z","1"),
    observation("l2","left","2026-01-02T00:00:00.000Z","2026-01-02T01:00:00.000Z","3"),
    observation("l3","left","2026-01-03T00:00:00.000Z","2026-01-03T01:00:00.000Z","6"),
    observation("r1","right","2026-01-01T00:00:00.000Z","2026-01-01T01:00:00.000Z","10"),
    observation("r2","right","2026-01-02T00:00:00.000Z","2026-01-02T01:00:00.000Z","20"),
    observation("r3","right","2026-01-03T00:00:00.000Z","2026-01-03T01:00:00.000Z","40"),
  ]);
  const result = await measureRepositoryBackedHistoricalRelationship({
    methodology: { ...methodology, transformation: "CHANGE" },
    repository: repo,
  });
  assert.equal(result.sampleSize, 2);
  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.correlation, undefined);
});

test("REL-001 refuses correlation when either paired series has zero variance", async () => {
  const repo = new MemoryHistory([
    observation("l1","left","2026-01-01T00:00:00.000Z","2026-01-01T01:00:00.000Z","1"),
    observation("l2","left","2026-01-02T00:00:00.000Z","2026-01-02T01:00:00.000Z","1"),
    observation("l3","left","2026-01-03T00:00:00.000Z","2026-01-03T01:00:00.000Z","1"),
    observation("r1","right","2026-01-01T00:00:00.000Z","2026-01-01T01:00:00.000Z","1"),
    observation("r2","right","2026-01-02T00:00:00.000Z","2026-01-02T01:00:00.000Z","2"),
    observation("r3","right","2026-01-03T00:00:00.000Z","2026-01-03T01:00:00.000Z","3"),
  ]);
  const result = await measureRepositoryBackedHistoricalRelationship({ methodology, repository: repo });
  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.correlation, undefined);
});
