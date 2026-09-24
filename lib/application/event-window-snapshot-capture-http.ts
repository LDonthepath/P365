import { isCronRequestAuthorized } from "./cron-auth";
import {
  runEventWindowSnapshotCapture,
  type EventWindowCaptureReport,
} from "./event-window-snapshot-capture";

type CaptureRunner = () => Promise<EventWindowCaptureReport>;

export function createEventWindowSnapshotCaptureHandler(
  runner: CaptureRunner = () => runEventWindowSnapshotCapture(),
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

    const report = await runner();
    return Response.json(
      report,
      { status: report.status === "FAILED" ? 500 : 200 },
    );
  };
}
