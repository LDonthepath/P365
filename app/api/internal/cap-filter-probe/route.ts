import { isCronRequestAuthorized } from "../../../../lib/application/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;

function requireConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.P365_MEMORY_WRITE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase config unavailable");
  return { url: url.replace(/\/$/, ""), key };
}

async function count(params: URLSearchParams): Promise<number> {
  const { url, key } = requireConfig();
  const response = await fetch(url + "/rest/v1/market_memory?" + params.toString(), {
    headers: { apikey: key, Authorization: "Bearer " + key },
    cache: "no-store",
    signal: AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("probe read failed: " + response.status);
  return ((await response.json()) as unknown[]).length;
}

function eventParams(filterValue: string, identityValue?: string): URLSearchParams {
  const params = new URLSearchParams({
    select: "canonical_id",
    record_type: "eq.EVENT",
    "payload->>importance": filterValue,
    limit: "5",
  });
  if (identityValue) params.set("payload->identity->>key", identityValue);
  return params;
}

async function handle(request: Request): Promise<Response> {
  if (!isCronRequestAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = "event:v1:US:2026-09-24T12:30:00.000Z:initial-jobless-claims";
  const resultBase = new URLSearchParams({
    select: "canonical_id",
    record_type: "eq.EVENT_RESULT",
    limit: "5",
  });
  const resultQuoted = new URLSearchParams(resultBase);
  resultQuoted.set("payload->>eventIdentityKey", 'eq."' + identity + '"');
  const resultRaw = new URLSearchParams(resultBase);
  resultRaw.set("payload->>eventIdentityKey", "eq." + identity);

  const observationBase = new URLSearchParams({
    select: "canonical_id",
    record_type: "eq.OBSERVATION",
    "payload->>domain": "eq.MACRO",
    limit: "5",
  });
  const observationQuoted = new URLSearchParams(observationBase);
  observationQuoted.set("payload->>sourceId", 'eq."fred"');
  const observationRaw = new URLSearchParams(observationBase);
  observationRaw.set("payload->>sourceId", "eq.fred");

  const [
    eventImportanceQuoted,
    eventImportanceRaw,
    eventIdentityQuoted,
    eventIdentityRaw,
    eventResultQuoted,
    eventResultRaw,
    observationSourceQuoted,
    observationSourceRaw,
  ] = await Promise.all([
    count(eventParams('eq."HIGH"')),
    count(eventParams("eq.HIGH")),
    count(eventParams("eq.HIGH", 'eq."' + identity + '"')),
    count(eventParams("eq.HIGH", "eq." + identity)),
    count(resultQuoted),
    count(resultRaw),
    count(observationQuoted),
    count(observationRaw),
  ]);

  return Response.json({
    eventImportance: { quoted: eventImportanceQuoted, raw: eventImportanceRaw },
    eventIdentity: { quoted: eventIdentityQuoted, raw: eventIdentityRaw },
    eventResultIdentity: { quoted: eventResultQuoted, raw: eventResultRaw },
    observationSource: { quoted: observationSourceQuoted, raw: observationSourceRaw },
  });
}

export const GET = handle;
