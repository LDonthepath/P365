import { isCronRequestAuthorized } from "./cron-auth";
import {
  runEventWindowSnapshotRepair,
  type EventWindowCaptureReport,
} from "./event-window-snapshot-capture";

type RepairRunner = (eventIdentityKey: string) => Promise<EventWindowCaptureReport>;

export function createEventWindowSnapshotRepairHandler(
  runner: RepairRunner = (eventIdentityKey) =>
    runEventWindowSnapshotRepair(eventIdentityKey),
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
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

    const eventIdentityKey =
      new URL(request.url).searchParams.get("eventIdentityKey")?.trim() ?? "";
    if (!eventIdentityKey) {
      return Response.json(
        { error: "eventIdentityKey is required." },
        { status: 400 },
      );
    }

    const report = await runner(eventIdentityKey);
    return Response.json(
      report,
      { status: report.status === "FAILED" ? 500 : 200 },
    );
  };
}
