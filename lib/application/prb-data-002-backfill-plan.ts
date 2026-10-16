import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";
import type { MacroSeriesId } from "../data/macro-registry";

/**
 * #364 / PRB-DATA-002. Frozen #363 contract: 12 YoY target months through
 * August 2026 need the 24 preceding monthly index observations per series.
 * This is an OFFLINE manifest generator, not a scheduler or ingestion trigger.
 */
export const PRB_DATA_002_SERIES = [
  "CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE",
] as const satisfies readonly MacroSeriesId[];

/** Six non-overlapping four-month windows, each within the existing 120-day cap. */
export const PRB_DATA_002_WINDOWS = [
  { from: "2024-09-01", to: "2024-12-01" },
  { from: "2025-01-01", to: "2025-04-01" },
  { from: "2025-05-01", to: "2025-08-01" },
  { from: "2025-09-01", to: "2025-12-01" },
  { from: "2026-01-01", to: "2026-04-01" },
  { from: "2026-05-01", to: "2026-08-01" },
] as const;

export type PrbData002DryRunWindow = {
  from: string;
  to: string;
  /** Relative authenticated historical-ingestion query, never an automatic call. */
  query: string;
  seriesIds: readonly MacroSeriesId[];
  minimumProviderPages: number;
  expectedMonthlySeriesPeriods: number;
};

/**
 * Runs only local parser/allowlist/range validation. Never fetches from FRED,
 * writes Market Memory, calls cron, or reads server credentials.
 * A production operator must satisfy the issue's independent activation gates.
 */
export function buildPrbData002DryRunManifest(): PrbData002DryRunWindow[] {
  return PRB_DATA_002_WINDOWS.map(({ from, to }) => {
    const params = new URLSearchParams({
      providers: "fred",
      mode: "BACKFILL",
      fredSeries: PRB_DATA_002_SERIES.join(","),
      from,
      to,
    });
    const parsed = parseHistoricalIngestionRequest(params);
    if (!parsed.ok) throw new Error("PRB-DATA-002 invalid approved window: " + parsed.error);
    const { mode, providers, fred } = parsed.options;
    if (mode !== "BACKFILL" || providers.length !== 1 || providers[0] !== "fred"
        || fred?.observationStart !== from || fred.observationEnd !== to
        || fred.limit !== 100
        || fred.seriesIds?.join(",") !== PRB_DATA_002_SERIES.join(",")) {
      throw new Error("PRB-DATA-002 parser did not preserve the frozen scope");
    }
    return {
      from, to, query: params.toString(),
      seriesIds: [...PRB_DATA_002_SERIES],
      minimumProviderPages: PRB_DATA_002_SERIES.length,
      expectedMonthlySeriesPeriods: PRB_DATA_002_SERIES.length * 4,
    };
  });
}
