import { isCronRequestAuthorized } from "./cron-auth";
import {
  runEventWindowSnapshotRepair,
  type EventWindowCaptureReport,
  type EventWindowSnapshotRepairRequest,
} from "./event-window-snapshot-capture";

type RepairRunner = (
  request: EventWindowSnapshotRepairRequest,
) => Promise<EventWindowCaptureReport>;

export function createEventWindowSnapshotRepairHandler(
  runner: RepairRunner = (request) => runEventWindowSnapshotRepair(request),
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
  now: () => number = () => Date.now(),
): (request: Request) => Promise<Response> {
  return async function handle(request: Request): Promise<Response> {
    if (
      !isCronRequestAuthorized(
        request.headers.get("authorization"),
        readSecret(),
      )
    ) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!payload || typeof payload !== "object") {
      return Response.json({ error: "Repair body is required." }, { status: 400 });
    }

    const body = payload as Record<string, unknown>;
    const eventIdentityKey = typeof body.eventIdentityKey === "string"
      ? body.eventIdentityKey.trim()
      : "";
    const evaluatedAt = typeof body.evaluatedAt === "string"
      ? body.evaluatedAt.trim()
      : "";

    if (!eventIdentityKey.startsWith("event:v1:")) {
      return Response.json(
        { error: "eventIdentityKey must be a provider-independent event:v1 identity." },
        { status: 400 },
      );
    }

    const evaluatedAtMs = Date.parse(evaluatedAt);
    if (!Number.isFinite(evaluatedAtMs)) {
      return Response.json(
        { error: "evaluatedAt must be a valid ISO timestamp." },
        { status: 400 },
      );
    }
    if (evaluatedAtMs > now()) {
      return Response.json(
        { error: "evaluatedAt cannot be in the future." },
        { status: 400 },
      );
    }

    const report = await runner({
      eventIdentityKey,
      evaluatedAt: new Date(evaluatedAtMs).toISOString(),
    });

    return Response.json(
      report,
      { status: report.status === "FAILED" ? 500 : 200 },
    );
  };
}
