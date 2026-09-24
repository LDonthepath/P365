import type { MarketSnapshot } from "./market-snapshot";
import {
  SNAPSHOT_SUPERSESSION_POLICY_V1,
  selectActiveMarketSnapshot,
} from "./snapshot-supersession";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual),
    );
  }
}

function snapshot(
  id: string,
  metadata: MarketSnapshot["metadata"] = {},
): MarketSnapshot {
  return {
    id,
    version: "v1",
    capturedAt: "2026-10-15T12:25:00.000Z",
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    observationRefs: [],
    eventRefs: [],
    baselineRefs: [],
    stateRefs: [],
    sourceHealthRefs: [],
    requirements: [{ kind: "EVENT", key: "event-key" }],
    missingRequirements: [],
    quality: "COMPLETE",
    metadata,
  };
}

async function main(): Promise<void> {
  assertEqual(
    SNAPSHOT_SUPERSESSION_POLICY_V1,
    "append-only-snapshot-supersession-v1",
    "policy id is stable",
  );

  const original = snapshot("snapshot-original");
  const corrected = snapshot("snapshot-corrected", {
    supersedesSnapshotId: original.id,
  });
  assertEqual(
    selectActiveMarketSnapshot([original, corrected])?.id,
    corrected.id,
    "superseding Snapshot becomes the active tip",
  );

  let forkRejected = false;
  try {
    selectActiveMarketSnapshot([
      original,
      corrected,
      snapshot("snapshot-fork", { supersedesSnapshotId: original.id }),
    ]);
  } catch {
    forkRejected = true;
  }
  assertEqual(forkRejected, true, "supersession forks fail closed");

  let brokenRejected = false;
  try {
    selectActiveMarketSnapshot([
      snapshot("snapshot-broken", { supersedesSnapshotId: "missing" }),
    ]);
  } catch {
    brokenRejected = true;
  }
  assertEqual(brokenRejected, true, "missing supersession parent fails closed");
}

void main();
