import assert from "node:assert/strict";
import test from "node:test";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import { InMemoryEvidenceRepository } from "../repositories/memory";
import {
  GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY,
  gdeltGalSnapshotFromEvidence,
  gdeltGalSnapshotsToEvidence,
} from "./gdelt-gal-history";

function snapshot(asset: "BTC" | "GOLD", buildAt: string): GdeltGalFeedSnapshot {
  const build = Date.parse(buildAt);
  return {
    asset,
    feedLastBuildAt: new Date(build).toISOString(),
    feedWindowStartAt: new Date(build - 15 * 60 * 1000).toISOString(),
    coverage: "ROLLING_15_MINUTES",
    totalFeedItems: 100,
    invalidItemCount: 1,
    matchingCandidateCount: asset === "BTC" ? 1 : 0,
    candidateCoverage: "COMPLETE",
    candidates: asset === "BTC"
      ? [{
          asset,
          url: "https://example.com/bitcoin",
          title: "Bitcoin rises after macro headline",
          domain: "example.com",
          providerDate: new Date(build - 60_000).toISOString(),
          providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN",
        }]
      : [],
  };
}

test("GDELT durable snapshot Evidence is deterministic and preserves zero-candidate coverage", async () => {
  const retrievedAt = "2026-10-04T12:00:05.000Z";
  const evidence = gdeltGalSnapshotsToEvidence({
    snapshots: [
      snapshot("BTC", "2026-10-04T12:00:00.000Z"),
      snapshot("GOLD", "2026-10-04T12:00:00.000Z"),
    ],
    retrievedAt,
  });

  assert.equal(evidence.length, 2);
  assert.equal(evidence[0].kind, "NEWS");
  assert.equal(evidence[0].sourceId, "gdelt");
  assert.equal(evidence[0].releasedAt, "2026-10-04T12:00:00.000Z");
  assert.equal(evidence[0].retrievedAt, retrievedAt);
  assert.equal(
    evidence[0].metadata?.methodology,
    GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY,
  );
  assert.equal(evidence[0].metadata?.candidateCount, 1);
  assert.equal(evidence[0].metadata?.matchingCandidateCount, 1);
  assert.equal(evidence[0].metadata?.candidateCoverage, "COMPLETE");
  assert.equal(evidence[1].metadata?.candidateCount, 0);

  const repeated = gdeltGalSnapshotsToEvidence({
    snapshots: [snapshot("BTC", "2026-10-04T12:00:00.000Z")],
    retrievedAt: "2026-10-04T12:00:30.000Z",
  });
  assert.equal(
    evidence[0].id,
    repeated[0].id,
    "same asset + feed build must keep stable snapshot identity",
  );

  assert.deepEqual(
    gdeltGalSnapshotFromEvidence(evidence[0]),
    snapshot("BTC", "2026-10-04T12:00:00.000Z"),
  );
  assert.deepEqual(
    gdeltGalSnapshotFromEvidence(evidence[1]),
    snapshot("GOLD", "2026-10-04T12:00:00.000Z"),
  );
});

test("GDELT durable Evidence supports point-in-time replay by source, asset and retrieval cutoff", async () => {
  const repository = new InMemoryEvidenceRepository();
  const first = gdeltGalSnapshotsToEvidence({
    snapshots: [snapshot("BTC", "2026-10-04T12:00:00.000Z")],
    retrievedAt: "2026-10-04T12:00:05.000Z",
  })[0];
  const second = gdeltGalSnapshotsToEvidence({
    snapshots: [snapshot("BTC", "2026-10-04T12:05:00.000Z")],
    retrievedAt: "2026-10-04T12:05:05.000Z",
  })[0];
  const gold = gdeltGalSnapshotsToEvidence({
    snapshots: [snapshot("GOLD", "2026-10-04T12:05:00.000Z")],
    retrievedAt: "2026-10-04T12:05:05.000Z",
  })[0];

  await repository.saveMany([first, second, gold]);
  await repository.save(first);

  const history = await repository.findHistory({
    sourceId: "gdelt",
    kind: "NEWS",
    metadataEquals: {
      methodology: GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY,
      gdeltAsset: "BTC",
    },
    effectiveAtOnOrAfter: "2026-10-04T11:59:00.000Z",
    effectiveAtOnOrBefore: "2026-10-04T12:10:00.000Z",
    retrievedAtOnOrBefore: "2026-10-04T12:04:59.000Z",
    order: "ASC",
    limit: 20,
  });

  assert.deepEqual(history.map((item) => item.id), [first.id]);
});
