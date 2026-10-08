import {
  defiLlamaBackfillRangeError,
  HISTORICAL_INGESTION_PROVIDERS,
  type HistoricalIngestionMode,
  type HistoricalIngestionOptions,
  type HistoricalIngestionProvider,
} from "./historical-ingestion";
import { soSoValueBackfillRangeError } from "../data/sosovalue-etf-flow";
import { cftcGoldCotBackfillRangeError } from "../data/cftc-gold-cot";
import { MACRO_SERIES_REGISTRY, type MacroSeriesId } from "../data/macro-registry";

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
  const cftcReleaseAware = searchParams.get("cftcReleaseAware");
  if (cftcReleaseAware !== null) {
    if (cftcReleaseAware !== "1") {
      return { ok: false, error: "cftcReleaseAware must equal 1 when specified" };
    }
    if (mode !== "FORWARD" || providers.length !== 1 || providers[0] !== "cftc") {
      return { ok: false, error: "cftcReleaseAware requires FORWARD with only cftc provider" };
    }
  }
  // FRED series selection is opt-in; the legacy full-registry URL is unchanged.
  const selectorParams = searchParams.getAll("fredSeries");
  let fredSeries: MacroSeriesId[] | undefined;
  if (selectorParams.length > 0) {
    if (selectorParams.length !== 1 || mode !== "FORWARD" || !providers.includes("fred")
      || providers.some((provider) => provider !== "fred" && provider !== "coingecko-context")) {
      return { ok: false, error: "fredSeries requires FORWARD with fred (optionally coingecko-context)" };
    }
    const ids = selectorParams[0].split(",").map((id) => id.trim());
    const allowlist = new Set<string>(MACRO_SERIES_REGISTRY.map((s) => s.seriesId));
    if (ids.length < 1 || ids.length > MACRO_SERIES_REGISTRY.length
      || ids.some((id) => !allowlist.has(id)) || new Set(ids).size !== ids.length) {
      return { ok: false, error: "fredSeries must contain unique registered series IDs" };
    }
    fredSeries = ids as MacroSeriesId[];
  }
  if (mode === "FORWARD") return {
    ok: true,
    options: { mode, providers, ...(fredSeries ? { fred: { seriesIds: fredSeries } } : {}),
      ...(cftcReleaseAware === "1" ? { cftcReleaseAware: true } : {}) },
  };
  if (providers.length !== 1 || !["fred", "defillama", "sosovalue", "cftc"].includes(providers[0])) {
    return { ok: false, error: "BACKFILL requires exactly one supported provider: fred, defillama, sosovalue, or cftc" };
  }

  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  if (!from || !to || from > to) return { ok: false, error: "BACKFILL requires valid from/to date bounds" };
  if (providers[0] === "defillama") {
    const rangeError = defiLlamaBackfillRangeError({ from, to });
    if (rangeError) return { ok: false, error: rangeError };
    return { ok: true, options: { mode, providers, defillama: { from, to } } };
  }
  if (providers[0] === "sosovalue") {
    const rangeError = soSoValueBackfillRangeError({ from, to });
    if (rangeError) return { ok: false, error: rangeError };
    return { ok: true, options: { mode, providers, sosovalue: { from, to } } };
  }
  if (providers[0] === "cftc") {
    const rangeError = cftcGoldCotBackfillRangeError({ from, to });
    if (rangeError) return { ok: false, error: rangeError };
    return { ok: true, options: { mode, providers, cftc: { from, to } } };
  }
  return { ok: true, options: { mode, providers, fred: { observationStart: from, observationEnd: to, limit: 100 } } };
}
