import { createEventWindowSnapshotCaptureHandler } from "../../../../lib/application/event-window-snapshot-capture-http";

export const runtime = "nodejs";
export const maxDuration = 60;

const handle = createEventWindowSnapshotCaptureHandler();

export const GET = handle;
export const POST = handle;
