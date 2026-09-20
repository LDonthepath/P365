import { createHistoricalIngestionHandler } from "../../../../lib/application/historical-ingestion-http";

export const runtime = "nodejs";
export const maxDuration = 60;

const handle = createHistoricalIngestionHandler();

export const GET = handle;
export const POST = handle;
