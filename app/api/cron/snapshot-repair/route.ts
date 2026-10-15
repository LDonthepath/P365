import { createRetiredAssetSnapshotHandler } from "../../../../lib/application/macro-cut-retired-snapshot-http";

export const runtime = "nodejs";
export const maxDuration = 60;

// The legacy asset Snapshot repair writer is intentionally inaccessible.
export const POST = createRetiredAssetSnapshotHandler();
