import { isCronRequestAuthorized } from "./cron-auth";
import { runEventIngestion, type EventIngestionOptions, type EventIngestionReport } from "./event-ingestion";
import { parseEventIngestionRequest } from "./event-ingestion-request";

type EventIngestionRunner = (options: EventIngestionOptions) => Promise<EventIngestionReport>;

export function createEventIngestionHandler(
  runner: EventIngestionRunner = runEventIngestion,
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
): (request: Request) => Promise<Response> {
  return async function handle(request: Request): Promise<Response> {
    if (!isCronRequestAuthorized(request.headers.get("authorization"), readSecret())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = parseEventIngestionRequest(new URL(request.url).searchParams);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const report = await runner(parsed.options);
    return Response.json(report, { status: report.status === "FAILED" ? 500 : 200 });
  };
}
