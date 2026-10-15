import { createRetiredAssetSnapshotHandler } from "../../../../lib/application/macro-cut-retired-snapshot-http";

export const runtime = "nodejs";
export const maxDuration = 60;

const handle = createRetiredAssetSnapshotHandler();
export const GET = handle;
export const POST = handle;
