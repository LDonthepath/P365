import { createEventIngestionHandler } from "../../../../lib/application/event-ingestion-http";

export const runtime = "nodejs";
export const maxDuration = 60;

const handle = createEventIngestionHandler();

export const GET = handle;
export const POST = handle;
