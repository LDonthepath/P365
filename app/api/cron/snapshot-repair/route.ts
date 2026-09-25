import { createEventWindowSnapshotRepairHandler } from "../../../../lib/application/event-window-snapshot-repair-http";

export const runtime = "nodejs";
export const maxDuration = 60;

const handle = createEventWindowSnapshotRepairHandler();

export const POST = handle;
