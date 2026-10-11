import type { ProviderHealth, SourceHealthStatus } from "../domain/types";

/**
 * Read-side Yahoo market series identities. These are NOT canonical source IDs:
 * historical rows retain sourceId="yahoo-finance" and their own seriesKey.
 */
export const YAHOO_MARKET_SERIES = [
  { seriesKey: "gold.futures.usd", label: "Emas berjangka COMEX (GC=F)" },
  { seriesKey: "russell2000.index.usd", label: "Russell 2000" },
  { seriesKey: "dxy.index.usd", label: "DXY" },
] as const;

export type YahooMarketSeriesKey = typeof YAHOO_MARKET_SERIES[number]["seriesKey"];

export type YahooSeriesHealth = ProviderHealth & {
  seriesKey: YahooMarketSeriesKey;
};

const STATUS_LABEL: Record<SourceHealthStatus, string> = {
  HEALTHY: "tersedia",
  EMPTY: "belum ada data",
  ERROR: "gagal membaca histori",
  UNAVAILABLE: "tidak tersedia",
  STALE: "data sudah lama",
};

export function yahooSeriesUnavailable(health: readonly YahooSeriesHealth[]): string[] {
  return health.flatMap((row) => {
    if (row.status === "HEALTHY") return [];
    const label = YAHOO_MARKET_SERIES.find((item) => item.seriesKey === row.seriesKey)?.label
      ?? row.seriesKey;
    return [`${label} (Yahoo Finance: ${STATUS_LABEL[row.status]})`];
  });
}

/**
 * Provider rollup must not report HEALTHY merely because one Yahoo instrument
 * succeeds. Detail remains in yahooSeriesHealth; this is only the summary.
 */
export function aggregateYahooHealth(health: readonly YahooSeriesHealth[]): ProviderHealth {
  const priority: readonly SourceHealthStatus[] = [
    "ERROR", "UNAVAILABLE", "EMPTY", "STALE", "HEALTHY",
  ];
  const status = priority.find((item) => health.some((row) => row.status === item))
    ?? "EMPTY";
  const fetchedAt = health.map((row) => row.fetchedAt)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort()
    .at(-1) ?? "";
  return {
    sourceId: "yahoo-finance",
    status,
    fetchedAt,
    itemCount: health.reduce((sum, row) => sum + row.itemCount, 0),
    ...(status === "HEALTHY" ? {} : {
      message: "Status per instrumen: " + health.map((row) => {
        const name = YAHOO_MARKET_SERIES.find((item) => item.seriesKey === row.seriesKey)?.label
          ?? row.seriesKey;
        return `${name} ${STATUS_LABEL[row.status]}`;
      }).join("; "),
    }),
  };
}
