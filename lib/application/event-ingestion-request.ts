import {
  EVENT_INGESTION_PROVIDERS,
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

  return {
    ok: true,
    options: {
      providers: requestedProviders as EventIngestionProvider[],
      jurisdictions: requestedJurisdictions as EventIngestionJurisdiction[],
    },
  };
}
