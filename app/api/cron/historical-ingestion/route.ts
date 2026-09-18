import { NextRequest } from "next/server";
import { runHistoricalIngestion, type HistoricalIngestionMode } from "../../../../lib/application/historical-ingestion";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function parseDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

async function handle(request: NextRequest): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const requestedMode = request.nextUrl.searchParams.get("mode")?.toUpperCase() as HistoricalIngestionMode | undefined;
  const mode = requestedMode === "BACKFILL" ? "BACKFILL" : "FORWARD";
  const from = parseDate(request.nextUrl.searchParams.get("from"));
  const to = parseDate(request.nextUrl.searchParams.get("to"));
  if (mode === "BACKFILL" && (!from || !to || from > to)) return Response.json({ error: "BACKFILL requires valid from/to date bounds" }, { status: 400 });
  const report = await runHistoricalIngestion({ mode, fred: mode === "BACKFILL" ? { observationStart: from, observationEnd: to, limit: 100 } : undefined });
  return Response.json(report, { status: report.status === "FAILED" ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
