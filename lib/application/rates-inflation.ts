import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { FRESHNESS_POLICIES, qualityFromMacroCadence, qualityFromMarketHours } from "../domain/freshness";
import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

const DAY = 24 * 60 * 60 * 1000;
const SEP_SOURCE_ID = "federal-reserve";
const SEP_MEDIAN_SUFFIX = ".median_pct";
const SEP_LONGER_RUN_KEY = "policy.us.sep.ffr.longer_run.median_pct";
const SOURCE_SERIES = [
  "EFFR",
  "IORB",
  "SOFR",
  "WRESBAL",
  "DGS2",
  "DFII10",
  "DTWEXBGS",
  "T10Y2Y",
] as const;
const SERIES = [
  "EFFR",
  "IORB",
  "SOFR",
  "SOFR_IORB_SPREAD",
  "WRESBAL",
  "DGS2",
  "DFII10",
  "DTWEXBGS",
  "T10Y2Y",
] as const;

export type RatesSeriesKey = (typeof SERIES)[number];
export type RatesSeriesValueUnit = "PERCENT" | "BPS" | "USD_BILLIONS" | "INDEX";
export type RatesSeriesChangeUnit = "BPS" | "USD_BILLIONS" | "PERCENT";
export type RatesSeriesCadence = "DAILY" | "WEEKLY";

export type RatesSeriesPoint = {
  seriesKey: RatesSeriesKey;
  value: number;
  valueUnit: RatesSeriesValueUnit;
  observedAt: string;
  retrievedAt: string;
  quality: DataQuality;
  cadence: RatesSeriesCadence;
  change1d: number | null;
  change1dFrom: string | null;
  change1w: number | null;
  change1wFrom: string | null;
  changeUnit: RatesSeriesChangeUnit;
};

export type SepMedianPathPoint = {
  seriesKey: string;
  horizon: string;
  valuePct: number;
  observedAt: string;
  retrievedAt: string;
  quality: DataQuality;
};

export type SepPolicyExpectationReadModel =
  | {
      status: "OK";
      releaseDate: string;
      observedAt: string;
      retrievedAt: string;
      meetingStartDate: string | null;
      meetingEndDate: string | null;
      sourceUrl: string | null;
      points: SepMedianPathPoint[];
    }
  | { status: "UNAVAILABLE"; reason: string };

export type UnifiedMacroKey = "dxy.index.usd" | "DGS2" | "DFII10";
export type UnifiedMacroPoint = {
  seriesKey: UnifiedMacroKey;
  latest: { observationId: string; value: number; observedAt: string; retrievedAt: string; quality: DataQuality; freshness: DataQuality; sourceId: string } | null;
  previous: { observationId: string; value: number; observedAt: string; retrievedAt: string } | null;
  change: number | null;
  reason: string | null;
};

export type RatesInflationReadModel =
  | { status: "OK"; series: RatesSeriesPoint[]; sep: SepPolicyExpectationReadModel; unifiedMacro?: UnifiedMacroPoint[] }
  | { status: "UNAVAILABLE"; reason: string; sep: SepPolicyExpectationReadModel; unifiedMacro?: UnifiedMacroPoint[] };

type SourceSeriesKey = (typeof SOURCE_SERIES)[number];

type PointDefinition = {
  cadence: RatesSeriesCadence;
  valueUnit: RatesSeriesValueUnit;
  changeUnit: RatesSeriesChangeUnit;
};

const DEFINITIONS: Record<SourceSeriesKey, PointDefinition> = {
  EFFR: { cadence: "DAILY", valueUnit: "PERCENT", changeUnit: "BPS" },
  IORB: { cadence: "DAILY", valueUnit: "PERCENT", changeUnit: "BPS" },
  SOFR: { cadence: "DAILY", valueUnit: "PERCENT", changeUnit: "BPS" },
  WRESBAL: { cadence: "WEEKLY", valueUnit: "USD_BILLIONS", changeUnit: "USD_BILLIONS" },
  DGS2: { cadence: "DAILY", valueUnit: "PERCENT", changeUnit: "BPS" },
  DFII10: { cadence: "DAILY", valueUnit: "PERCENT", changeUnit: "BPS" },
  DTWEXBGS: { cadence: "DAILY", valueUnit: "INDEX", changeUnit: "PERCENT" },
  T10Y2Y: { cadence: "DAILY", valueUnit: "PERCENT", changeUnit: "BPS" },
};

function seriesKey(observation: Observation): string | null {
  return observation.identity?.seriesKey
    ?? (typeof observation.metadata?.seriesId === "string" ? observation.metadata.seriesId : null)
    ?? (typeof observation.metadata?.metricId === "string" ? observation.metadata.metricId : null);
}

function metadataString(observation: Observation, key: string): string | null {
  const value = observation.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function sepMedianSeriesKey(year: number): string {
  return `policy.us.sep.ffr.year_end_${year}.median_pct`;
}

function sepMedianSeriesKeys(asOf: Date): string[] {
  const year = asOf.getUTCFullYear();
  return [
    ...Array.from({ length: 6 }, (_, index) => sepMedianSeriesKey(year - 1 + index)),
    SEP_LONGER_RUN_KEY,
  ];
}

function sepHorizonLabel(key: string): string {
  if (key === SEP_LONGER_RUN_KEY) return "LONGER_RUN";
  const match = key.match(/^policy\.us\.sep\.ffr\.year_end_(20\d{2})\.median_pct$/);
  return match ? `YEAR_END_${match[1]}` : key;
}

async function buildSepPolicyExpectationReadModel(
  repository: HistoricalObservationRepository,
  asOf: Date,
): Promise<SepPolicyExpectationReadModel> {
  const end = asOf.toISOString();
  const keys = sepMedianSeriesKeys(asOf);

  try {
    const histories = await Promise.all(keys.map((key) => repository.findHistory({
      identity: { domain: "MACRO", seriesKey: key },
      sourceId: SEP_SOURCE_ID,
      observedAtOnOrBefore: end,
      retrievedAtOnOrBefore: end,
      order: "DESC",
      limit: 8,
    })));
    const rows = histories
      .flat()
      .filter((row) =>
        row.sourceId === SEP_SOURCE_ID
        && seriesKey(row)?.endsWith(SEP_MEDIAN_SUFFIX)
        && metadataString(row, "factType") === "PUBLISHED_MEDIAN"
      );

    if (!rows.length) {
      return { status: "UNAVAILABLE", reason: "Median policy path SEP belum tersedia di Market Memory." };
    }

    const latestRelease = rows
      .map((row) => row.observedAt)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    if (!latestRelease || !Number.isFinite(Date.parse(latestRelease))) {
      return { status: "UNAVAILABLE", reason: "Timestamp rilis SEP terbaru tidak valid." };
    }

    const rowsAtRelease = rows.filter((row) => row.observedAt === latestRelease);
    const latestBySeries = new Map<string, Observation>();
    for (const row of rowsAtRelease.sort((a, b) =>
      Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt) || b.id.localeCompare(a.id)
    )) {
      const key = seriesKey(row);
      if (key && !latestBySeries.has(key)) latestBySeries.set(key, row);
    }

    const selectedRows: Observation[] = [];
    const points = keys.flatMap((key): SepMedianPathPoint[] => {
      const row = latestBySeries.get(key);
      const value = numericValue(row ?? null);
      if (!row || value === null) return [];
      selectedRows.push(row);
      return [{
        seriesKey: key,
        horizon: sepHorizonLabel(key),
        valuePct: value,
        observedAt: row.observedAt,
        retrievedAt: row.retrievedAt,
        quality: row.quality,
      }];
    });

    if (!points.length) {
      return { status: "UNAVAILABLE", reason: "Median policy path SEP terbaru tidak memiliki nilai yang dapat ditampilkan." };
    }

    const representative = selectedRows
      .slice()
      .sort((a, b) => Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt) || b.id.localeCompare(a.id))[0];
    const releaseDate = metadataString(representative, "releaseDate") ?? latestRelease.slice(0, 10);

    return {
      status: "OK",
      releaseDate,
      observedAt: latestRelease,
      retrievedAt: latestRetrievedAt(selectedRows),
      meetingStartDate: metadataString(representative, "meetingStartDate"),
      meetingEndDate: metadataString(representative, "meetingEndDate"),
      sourceUrl: metadataString(representative, "sourceUrl"),
      points,
    };
  } catch (error) {
    console.error("SEP durable read failed:", error instanceof Error ? error.message : "unknown error");
    return { status: "UNAVAILABLE", reason: "Data SEP sedang tidak dapat dibaca." };
  }
}

function latestOnOrBefore(rows: Observation[], key: SourceSeriesKey, at: number): Observation | null {
  return rows
    .filter((row) => seriesKey(row) === key && Date.parse(row.observedAt) <= at)
    .sort((a, b) =>
      Date.parse(b.observedAt) - Date.parse(a.observedAt)
      || Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt)
      || b.id.localeCompare(a.id)
    )[0] ?? null;
}

function numericValue(observation: Observation | null): number | null {
  if (!observation || !observation.value.trim()) return null;
  const value = Number(observation.value);
  return Number.isFinite(value) ? value : null;
}

function worstQuality(items: Observation[]): DataQuality {
  if (items.some((item) => item.quality === "STALE")) return "STALE";
  if (items.some((item) => item.quality === "PARTIAL")) return "PARTIAL";
  if (items.some((item) => item.quality === "UNKNOWN")) return "UNKNOWN";
  return "FRESH";
}

function latestRetrievedAt(items: Observation[]): string {
  return items
    .map((item) => item.retrievedAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function convertedValue(key: SourceSeriesKey, observation: Observation): number | null {
  const value = numericValue(observation);
  if (value === null) return null;
  return key === "WRESBAL" ? value / 1000 : value;
}

function sourceChange(
  key: SourceSeriesKey,
  latestValue: number,
  predecessor: Observation | null,
): number | null {
  if (!predecessor) return null;
  const predecessorValue = convertedValue(key, predecessor);
  if (predecessorValue === null) return null;

  if (DEFINITIONS[key].changeUnit === "BPS") {
    return (latestValue - predecessorValue) * 100;
  }
  if (DEFINITIONS[key].changeUnit === "PERCENT") {
    return predecessorValue === 0 ? null : ((latestValue - predecessorValue) / predecessorValue) * 100;
  }
  return latestValue - predecessorValue;
}

function buildSourcePoint(
  rows: Observation[],
  key: SourceSeriesKey,
  asOf: number,
): RatesSeriesPoint | null {
  const latest = latestOnOrBefore(rows, key, asOf);
  if (!latest) return null;
  const latestValue = convertedValue(key, latest);
  if (latestValue === null) return null;

  const latestAt = Date.parse(latest.observedAt);
  if (!Number.isFinite(latestAt)) return null;

  const oneDay = DEFINITIONS[key].cadence === "DAILY"
    ? latestOnOrBefore(rows, key, latestAt - DAY)
    : null;
  const oneWeek = latestOnOrBefore(rows, key, latestAt - 7 * DAY);

  return {
    seriesKey: key,
    value: latestValue,
    valueUnit: DEFINITIONS[key].valueUnit,
    observedAt: latest.observedAt,
    retrievedAt: latest.retrievedAt,
    quality: latest.quality,
    cadence: DEFINITIONS[key].cadence,
    change1d: sourceChange(key, latestValue, oneDay),
    change1dFrom: oneDay?.observedAt ?? null,
    change1w: sourceChange(key, latestValue, oneWeek),
    change1wFrom: oneWeek?.observedAt ?? null,
    changeUnit: DEFINITIONS[key].changeUnit,
  };
}

type SpreadPoint = {
  valueBps: number;
  observedAt: string;
  retrievedAt: string;
  quality: DataQuality;
};

function spreadOnOrBefore(rows: Observation[], at: number): SpreadPoint | null {
  const sofr = latestOnOrBefore(rows, "SOFR", at);
  const sofrValue = numericValue(sofr);
  if (!sofr || sofrValue === null) return null;

  const sofrAt = Date.parse(sofr.observedAt);
  if (!Number.isFinite(sofrAt)) return null;

  const iorb = latestOnOrBefore(rows, "IORB", sofrAt);
  const iorbValue = numericValue(iorb);
  if (!iorb || iorbValue === null) return null;

  return {
    valueBps: (sofrValue - iorbValue) * 100,
    observedAt: sofr.observedAt,
    retrievedAt: latestRetrievedAt([sofr, iorb]),
    quality: worstQuality([sofr, iorb]),
  };
}

function buildSpreadPoint(rows: Observation[], asOf: number): RatesSeriesPoint | null {
  const latest = spreadOnOrBefore(rows, asOf);
  if (!latest) return null;

  const latestAt = Date.parse(latest.observedAt);
  const oneDay = spreadOnOrBefore(rows, latestAt - DAY);
  const oneWeek = spreadOnOrBefore(rows, latestAt - 7 * DAY);

  return {
    seriesKey: "SOFR_IORB_SPREAD",
    value: latest.valueBps,
    valueUnit: "BPS",
    observedAt: latest.observedAt,
    retrievedAt: latest.retrievedAt,
    quality: latest.quality,
    cadence: "DAILY",
    change1d: oneDay ? latest.valueBps - oneDay.valueBps : null,
    change1dFrom: oneDay?.observedAt ?? null,
    change1w: oneWeek ? latest.valueBps - oneWeek.valueBps : null,
    change1wFrom: oneWeek?.observedAt ?? null,
    changeUnit: "BPS",
  };
}

/** One bounded durable DXY read shared with the existing MVP factual context. */
export async function readDxyMacroHistory(
  repository: HistoricalObservationRepository, asOf: Date,
): Promise<Observation[]> {
  try {
    return await repository.findHistory({
      identity: { domain: "ASSET", seriesKey: "dxy.index.usd" },
      sourceId: "yahoo-finance", observedAtOnOrBefore: asOf.toISOString(),
      retrievedAtOnOrBefore: asOf.toISOString(), order: "DESC", limit: 100,
    });
  } catch (error) {
    console.error("Unified Macro DXY read failed:", error instanceof Error ? error.message : "unknown error");
    return [];
  }
}

export function buildUnifiedMacroPoint(
  key: UnifiedMacroKey, rows: Observation[], asOf: Date,
): UnifiedMacroPoint {
  const dxy = key === "dxy.index.usd";
  // Resolve revisions before qualification. A rejected latest revision must not
  // resurrect an older revision of the same measurement.
  const measurements = new Map<number, Observation>();
  const ordered = rows.filter((row) => seriesKey(row) === key
    && row.sourceId === (dxy ? "yahoo-finance" : "fred")
    && row.domain === (dxy ? "ASSET" : "MACRO")
    && Number.isFinite(Date.parse(row.observedAt))
    && Number.isFinite(Date.parse(row.retrievedAt))
    && Date.parse(row.observedAt) <= Date.parse(row.retrievedAt)
    && Date.parse(row.retrievedAt) <= asOf.getTime())
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)
      || Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt) || b.id.localeCompare(a.id));
  for (const row of ordered) {
    const at = Date.parse(row.observedAt);
    if (!measurements.has(at)) measurements.set(at, row);
  }
  const qualified = [...measurements.values()].filter((row) => {
    if (numericValue(row) === null || !["FRESH", "STALE"].includes(row.quality)) return false;
    if (dxy) return numericValue(row)! > 0 && metadataString(row, "unit") === "Index"
      && (row.provenance?.nativeSymbol ?? metadataString(row, "symbol")) === "DX-Y.NYB";
    return metadataString(row, "unit") === "Percent" && metadataString(row, "frequency") === "DAILY"
      // A FRED date anchor is not a fetch-time quote. Reject legacy fetch-time rows.
      && Date.parse(row.observedAt) === Date.parse(row.observedAt.slice(0, 10))
      && (!metadataString(row, "observationDate") || metadataString(row, "observationDate") === row.observedAt.slice(0, 10));
  });
  const latest = qualified[0];
  const previous = qualified[1];
  if (!latest) return { seriesKey: key, latest: null, previous: null, change: null,
    reason: "Observasi terkualifikasi belum tersedia dalam riwayat yang dibaca." };
  const definition = MACRO_SERIES_REGISTRY.find((item) => item.seriesId === key);
  const freshness = dxy
    ? latest.metadata?.freshnessCalendar === "ICE_USDX"
      ? qualityFromMarketHours({ observedAt: latest.observedAt, evaluatedAt: asOf.toISOString(),
          calendar: "ICE_USDX", maxAgeMs: FRESHNESS_POLICIES.MARKET_REALTIME.maxAgeMs })
      : "UNKNOWN"
    : definition ? qualityFromMacroCadence({ observationDate: latest.observedAt.slice(0, 10),
        evaluatedAt: asOf.toISOString(), frequency: definition.frequency, toleranceMs: definition.freshnessMs }) : "UNKNOWN";
  const value = numericValue(latest)!;
  return {
    seriesKey: key,
    latest: { observationId: latest.id, value, observedAt: latest.observedAt,
      retrievedAt: latest.retrievedAt, quality: latest.quality, freshness, sourceId: latest.sourceId },
    previous: previous ? { observationId: previous.id, value: numericValue(previous)!,
      observedAt: previous.observedAt, retrievedAt: previous.retrievedAt } : null,
    change: previous ? (value - numericValue(previous)!) * (dxy ? 1 : 100) : null,
    reason: previous ? null : "Observasi valid sebelumnya belum tersedia dalam riwayat yang dibaca.",
  };
}

/**
 * Read-only factual Rates & Policy slice over durable canonical FRED history.
 *
 * The derived SOFR-IORB spread is anchored to the latest SOFR observation and
 * uses the latest IORB observation already knowable on or before that same
 * effective date. Weekly reserve balances deliberately do not fabricate a 1D
 * delta. No regime, directional market label, causality, or trading semantics
 * are produced here.
 */
export async function buildRatesInflationReadModel(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
  sharedDxyHistory?: Promise<Observation[]>,
): Promise<RatesInflationReadModel> {
  const end = asOf.toISOString();
  const start = new Date(asOf.getTime() - 21 * DAY).toISOString();
  const dxyPromise = sharedDxyHistory ?? readDxyMacroHistory(repository, asOf);
  const sep = await buildSepPolicyExpectationReadModel(repository, asOf);
  const dxyRows = await dxyPromise;
  const dxy = buildUnifiedMacroPoint("dxy.index.usd", dxyRows, asOf);

  try {
    const histories = await Promise.all(SOURCE_SERIES.map((key) => repository.findHistory({
      identity: { domain: "MACRO", seriesKey: key },
      observedAtOnOrAfter: start,
      observedAtOnOrBefore: end,
      retrievedAtOnOrBefore: end,
      sourceId: key === "DGS2" || key === "DFII10" ? "fred" : undefined,
      order: key === "DGS2" || key === "DFII10" ? "DESC" : "ASC",
      limit: 100,
    })));
    const rows = histories.flat();
    const unifiedMacro = [dxy, ...(["DGS2", "DFII10"] as const).map((key) => buildUnifiedMacroPoint(key, rows, asOf))];

    const pointsByKey = new Map<RatesSeriesKey, RatesSeriesPoint>();
    for (const key of SOURCE_SERIES) {
      const point = buildSourcePoint(rows, key, asOf.getTime());
      if (point) pointsByKey.set(key, point);
    }
    const spread = buildSpreadPoint(rows, asOf.getTime());
    if (spread) pointsByKey.set(spread.seriesKey, spread);

    const points = SERIES.flatMap((key) => {
      const point = pointsByKey.get(key);
      return point ? [point] : [];
    });

    if (!points.length) {
      return { status: "UNAVAILABLE", reason: "Riwayat faktual Rates & Policy belum tersedia.", sep, unifiedMacro };
    }
    return { status: "OK", series: points, sep, unifiedMacro };
  } catch (error) {
    console.error("Rates & Policy durable read failed:", error instanceof Error ? error.message : "unknown error");
    return { status: "UNAVAILABLE", reason: "Data faktual Rates & Policy sedang tidak dapat dibaca.", sep,
      unifiedMacro: [dxy, ...(["DGS2", "DFII10"] as const).map((key) => buildUnifiedMacroPoint(key, [], asOf))] };
  }
}
