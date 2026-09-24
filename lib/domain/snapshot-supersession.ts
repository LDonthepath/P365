import type { MarketSnapshot } from "./market-snapshot";

export const SNAPSHOT_SUPERSESSION_POLICY_V1 =
  "append-only-snapshot-supersession-v1" as const;

export function supersededSnapshotId(
  snapshot: MarketSnapshot,
): string | null {
  const value = snapshot.metadata?.supersedesSnapshotId;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Resolves one immutable supersession chain to its active tip.
 *
 * Callers must provide snapshots for one logical slot. Forks, cycles, broken
 * parent references, or cross-scope/time links fail closed rather than choosing
 * an arbitrary historical version.
 */
export function selectActiveMarketSnapshot(
  snapshots: MarketSnapshot[],
): MarketSnapshot | null {
  if (snapshots.length === 0) return null;

  const byId = new Map<string, MarketSnapshot>();
  for (const snapshot of snapshots) {
    if (byId.has(snapshot.id)) {
      throw new Error("Snapshot supersession set contains duplicate ids.");
    }
    byId.set(snapshot.id, snapshot);
  }

  const superseded = new Set<string>();
  for (const snapshot of snapshots) {
    const parentId = supersededSnapshotId(snapshot);
    if (!parentId) continue;
    if (parentId === snapshot.id) {
      throw new Error("Snapshot cannot supersede itself.");
    }
    const parent = byId.get(parentId);
    if (!parent) {
      throw new Error("Snapshot supersession parent is missing from the supplied slot history.");
    }
    if (
      parent.scope !== snapshot.scope
      || Date.parse(parent.capturedAt) !== Date.parse(snapshot.capturedAt)
    ) {
      throw new Error("Snapshot supersession must remain inside one scope/capturedAt slot.");
    }
    superseded.add(parentId);
  }

  const tips = snapshots.filter((snapshot) => !superseded.has(snapshot.id));
  if (tips.length !== 1) {
    throw new Error("Snapshot supersession history must have exactly one active tip.");
  }

  const tip = tips[0];
  for (const snapshot of snapshots) {
    const seen = new Set<string>();
    let current: MarketSnapshot | undefined = snapshot;
    while (current) {
      if (seen.has(current.id)) {
        throw new Error("Snapshot supersession history contains a cycle.");
      }
      seen.add(current.id);
      const parentId = supersededSnapshotId(current);
      current = parentId ? byId.get(parentId) : undefined;
    }
  }

  return tip;
}
