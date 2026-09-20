import { NextRequest } from "next/server";
import { runHistoricalIngestion } from "../../../../lib/application/historical-ingestion";
import { parseHistoricalIngestionRequest } from "../../../../lib/application/historical-ingestion-request";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function handle(request: NextRequest): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = parseHistoricalIngestionRequest(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const report = await runHistoricalIngestion(parsed.options);
  return Response.json(report, { status: report.status === "FAILED" ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
