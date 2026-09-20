import {
  EVENT_INGESTION_PROVIDERS,
  type EventIngestionBiquoteOptions,
  type EventIngestionOptions,
  type EventIngestionProvider,
} from "./event-ingestion";
import {
  EVENT_INGESTION_JURISDICTIONS,
  type EventIngestionJurisdiction,
} from "../data/event-jurisdiction";

export type EventIngestionRequestParseResult =
  | { ok: true; options: EventIngestionOptions }
  | { ok: false; error: string };

function parseBiquoteOptions(searchParams: URLSearchParams): { ok: true; options?: EventIngestionBiquoteOptions } | { ok: false; error: string } {
  const fromRaw = searchParams.get("biquoteFrom");
  const toRaw = searchParams.get("biquoteTo");
  const importanceRaw = searchParams.get("biquoteImportance");
  const limitRaw = searchParams.get("biquoteLimit");

  const hasAny = fromRaw !== null || toRaw !== null || importanceRaw !== null || limitRaw !== null;
  if (!hasAny) return { ok: true };

  if ((fromRaw === null) !== (toRaw === null)) {
    return { ok: false, error: "biquoteFrom and biquoteTo must be provided together" };
  }

  let from: string | undefined;
  let to: string | undefined;
  if (fromRaw !== null && toRaw !== null) {
    const fromMs = Date.parse(fromRaw);
    const toMs = Date.parse(toRaw);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
      return { ok: false, error: "biquoteFrom/biquoteTo must be valid ordered timestamps" };
    }
    from = new Date(fromMs).toISOString();
    to = new Date(toMs).toISOString();
  }

  let importance: EventIngestionBiquoteOptions["importance"];
  if (importanceRaw !== null) {
    const normalized = importanceRaw.trim().toLowerCase();
    if (normalized !== "low" && normalized !== "medium" && normalized !== "high") {
      return { ok: false, error: "biquoteImportance must be low, medium, or high" };
    }
    importance = normalized;
  }

  let limit: number | undefined;
  if (limitRaw !== null) {
    if (!/^\d+$/.test(limitRaw)) return { ok: false, error: "biquoteLimit must be an integer from 1 to 500" };
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      return { ok: false, error: "biquoteLimit must be an integer from 1 to 500" };
    }
  }

  return {
    ok: true,
    options: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(importance ? { importance } : {}),
      ...(limit !== undefined ? { limit } : {}),
    },
  };
}

export function parseEventIngestionRequest(searchParams: URLSearchParams): EventIngestionRequestParseResult {
  const rawProviders = searchParams.get("providers");
  if (!rawProviders) return { ok: false, error: "providers is required" };
  const requestedProviders = [...new Set(rawProviders.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (requestedProviders.length === 0) return { ok: false, error: "providers must contain at least one provider" };
  const allowedProviders = new Set<string>(EVENT_INGESTION_PROVIDERS);
  const invalidProviders = requestedProviders.filter((value) => !allowedProviders.has(value));
  if (invalidProviders.length > 0) return { ok: false, error: `Unsupported providers: ${invalidProviders.join(",")}` };

  const rawJurisdictions = searchParams.get("jurisdictions");
  if (!rawJurisdictions) return { ok: false, error: "jurisdictions is required" };
  const requestedJurisdictions = [...new Set(rawJurisdictions.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))];
  if (requestedJurisdictions.length === 0) return { ok: false, error: "jurisdictions must contain at least one jurisdiction" };
  const allowedJurisdictions = new Set<string>(EVENT_INGESTION_JURISDICTIONS);
  const invalidJurisdictions = requestedJurisdictions.filter((value) => !allowedJurisdictions.has(value));
  if (invalidJurisdictions.length > 0) return { ok: false, error: `Unsupported jurisdictions: ${invalidJurisdictions.join(",")}` };

  const parsedBiquote = parseBiquoteOptions(searchParams);
  if (!parsedBiquote.ok) return parsedBiquote;
  if (parsedBiquote.options && !requestedProviders.includes("biquote")) {
    return { ok: false, error: "Biquote filters require providers to include biquote" };
  }

  return {
    ok: true,
    options: {
      providers: requestedProviders as EventIngestionProvider[],
      jurisdictions: requestedJurisdictions as EventIngestionJurisdiction[],
      ...(parsedBiquote.options ? { biquote: parsedBiquote.options } : {}),
    },
  };
}
