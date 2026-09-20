import {
  runHistoricalIngestion,
  type HistoricalIngestionReport,
  type HistoricalIngestionOptions,
} from "./historical-ingestion";
import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";
import { isCronRequestAuthorized } from "./cron-auth";

type HistoricalIngestionRunner = (options: HistoricalIngestionOptions) => Promise<HistoricalIngestionReport>;

export function isHistoricalIngestionAuthorized(authorization: string | null, secret: string | undefined): boolean {
  return isCronRequestAuthorized(authorization, secret);
}

export function createHistoricalIngestionHandler(
  runner: HistoricalIngestionRunner = runHistoricalIngestion,
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
): (request: Request) => Promise<Response> {
  return async function handle(request: Request): Promise<Response> {
    if (!isHistoricalIngestionAuthorized(request.headers.get("authorization"), readSecret())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = parseHistoricalIngestionRequest(new URL(request.url).searchParams);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const report = await runner(parsed.options);
    return Response.json(report, { status: report.status === "FAILED" ? 500 : 200 });
  };
}
