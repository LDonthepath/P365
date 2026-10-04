import { createHash } from "node:crypto";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import type { Evidence } from "../domain/types";

export const GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY =
  "gdelt-gal-durable-snapshot-v1" as const;

type DurableGdeltGalPayload = {
  version: "v1";
  snapshot: GdeltGalFeedSnapshot;
};

function snapshotId(snapshot: GdeltGalFeedSnapshot): string {
  const digest = createHash("sha256")
    .update(`${snapshot.asset}|${snapshot.feedLastBuildAt}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `gdelt-gal-snapshot-v1-${digest}`;
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function assertSnapshot(snapshot: GdeltGalFeedSnapshot): void {
  if (snapshot.asset !== "BTC" && snapshot.asset !== "GOLD") {
    throw new Error("GDELT durable snapshot requires BTC or GOLD asset");
  }
  if (!validTimestamp(snapshot.feedLastBuildAt) || !validTimestamp(snapshot.feedWindowStartAt)) {
    throw new Error("GDELT durable snapshot requires valid feed timestamps");
  }
  if (Date.parse(snapshot.feedWindowStartAt) > Date.parse(snapshot.feedLastBuildAt)) {
    throw new Error("GDELT durable snapshot feed window is inverted");
  }
  if (snapshot.coverage !== "ROLLING_15_MINUTES") {
    throw new Error("GDELT durable snapshot requires rolling-15-minute coverage");
  }
  if (!Number.isInteger(snapshot.totalFeedItems) || snapshot.totalFeedItems < 0) {
    throw new Error("GDELT durable snapshot totalFeedItems must be a non-negative integer");
  }
  if (!Number.isInteger(snapshot.invalidItemCount) || snapshot.invalidItemCount < 0) {
    throw new Error("GDELT durable snapshot invalidItemCount must be a non-negative integer");
  }

  const urls = new Set<string>();
  for (const candidate of snapshot.candidates) {
    if (candidate.asset !== snapshot.asset) {
      throw new Error("GDELT durable snapshot candidate asset must match snapshot asset");
    }
    if (!candidate.title.trim() || !candidate.url.trim() || !candidate.domain.trim()) {
      throw new Error("GDELT durable snapshot candidate requires title/url/domain");
    }
    if (urls.has(candidate.url)) {
      throw new Error("GDELT durable snapshot candidates must be URL-deduplicated");
    }
    urls.add(candidate.url);
    if (
      candidate.providerDate !== null
      && !validTimestamp(candidate.providerDate)
    ) {
      throw new Error("GDELT durable snapshot candidate providerDate must be valid when present");
    }
    if (
      candidate.providerDateSemantics
        !== (candidate.providerDate ? "PUBLICATION_OR_FIRST_SEEN" : "UNAVAILABLE")
    ) {
      throw new Error("GDELT durable snapshot candidate timestamp semantics are inconsistent");
    }
  }
}

export function gdeltGalSnapshotsToEvidence(input: {
  snapshots: GdeltGalFeedSnapshot[];
  retrievedAt: string;
}): Evidence[] {
  if (!validTimestamp(input.retrievedAt)) {
    throw new Error("GDELT durable snapshots require a valid retrieval timestamp");
  }

  return input.snapshots.map((snapshot) => {
    assertSnapshot(snapshot);
    const payload: DurableGdeltGalPayload = {
      version: "v1",
      snapshot,
    };

    return {
      id: snapshotId(snapshot),
      sourceId: "gdelt",
      kind: "NEWS",
      subject: `GDELT GAL ${snapshot.asset} candidate snapshot`,
      content: JSON.stringify(payload),
      capturedAt: input.retrievedAt,
      retrievedAt: input.retrievedAt,
      // This Evidence row represents the provider feed snapshot itself.
      // feedLastBuildAt is therefore its source-native release time, not an
      // article publication timestamp.
      releasedAt: snapshot.feedLastBuildAt,
      metadata: {
        methodology: GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY,
        gdeltAsset: snapshot.asset,
        coverage: snapshot.coverage,
        feedWindowStartAt: snapshot.feedWindowStartAt,
        feedLastBuildAt: snapshot.feedLastBuildAt,
        totalFeedItems: snapshot.totalFeedItems,
        invalidItemCount: snapshot.invalidItemCount,
        candidateCount: snapshot.candidates.length,
      },
    };
  });
}

export function gdeltGalSnapshotFromEvidence(
  evidence: Evidence,
): GdeltGalFeedSnapshot | null {
  if (
    evidence.sourceId !== "gdelt"
    || evidence.kind !== "NEWS"
    || evidence.metadata?.methodology !== GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(evidence.content) as Partial<DurableGdeltGalPayload>;
    if (parsed.version !== "v1" || !parsed.snapshot) return null;
    assertSnapshot(parsed.snapshot);
    if (parsed.snapshot.feedLastBuildAt !== evidence.releasedAt) return null;
    if (parsed.snapshot.asset !== evidence.metadata?.gdeltAsset) return null;
    return parsed.snapshot;
  } catch {
    return null;
  }
}
