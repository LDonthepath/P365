import {
  HISTORICAL_INGESTION_PROVIDERS,
  type HistoricalIngestionMode,
  type HistoricalIngestionOptions,
  type HistoricalIngestionProvider,
} from "./historical-ingestion";

export type HistoricalIngestionRequestParseResult =
  | { ok: true; options: HistoricalIngestionOptions }
  | { ok: false; error: string };

function parseDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

export function parseHistoricalIngestionRequest(searchParams: URLSearchParams): HistoricalIngestionRequestParseResult {
  const rawProviders = searchParams.get("providers");
  if (!rawProviders) return { ok: false, error: "providers is required" };

  const requested = [...new Set(rawProviders.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (requested.length === 0) return { ok: false, error: "providers must contain at least one provider" };
  const allowed = new Set<string>(HISTORICAL_INGESTION_PROVIDERS);
  const invalid = requested.filter((provider) => !allowed.has(provider));
  if (invalid.length > 0) return { ok: false, error: `Unsupported providers: ${invalid.join(",")}` };
  const providers = requested as HistoricalIngestionProvider[];

  const rawMode = searchParams.get("mode")?.toUpperCase();
  if (rawMode && rawMode !== "FORWARD" && rawMode !== "BACKFILL") {
    return { ok: false, error: "mode must be FORWARD or BACKFILL" };
  }
  const mode: HistoricalIngestionMode = rawMode === "BACKFILL" ? "BACKFILL" : "FORWARD";
  if (mode === "FORWARD") return { ok: true, options: { mode, providers } };
  if (providers.some((provider) => provider !== "fred")) {
    return { ok: false, error: "BACKFILL is currently supported only for fred" };
  }

  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  if (!from || !to || from > to) return { ok: false, error: "BACKFILL requires valid from/to date bounds" };
  return {
    ok: true,
    options: { mode, providers, fred: { observationStart: from, observationEnd: to, limit: 100 } },
  };
}
