import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

const DAY = 24 * 60 * 60 * 1000;
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

export type RatesInflationReadModel =
  | { status: "OK"; series: RatesSeriesPoint[] }
  | { status: "UNAVAILABLE"; reason: string };

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
    ?? (typeof observation.metadata?.seriesId === "string" ? observation.metadata.seriesId : null);
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
): Promise<RatesInflationReadModel> {
  const end = asOf.toISOString();
  const start = new Date(asOf.getTime() - 21 * DAY).toISOString();

  try {
    const histories = await Promise.all(SOURCE_SERIES.map((key) => repository.findHistory({
      identity: { domain: "MACRO", seriesKey: key },
      observedAtOnOrAfter: start,
      observedAtOnOrBefore: end,
      retrievedAtOnOrBefore: end,
      order: "ASC",
      limit: 100,
    })));
    const rows = histories.flat();

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
      return { status: "UNAVAILABLE", reason: "Riwayat faktual Rates & Policy belum tersedia." };
    }
    return { status: "OK", series: points };
  } catch (error) {
    console.error("Rates & Policy durable read failed:", error instanceof Error ? error.message : "unknown error");
    return { status: "UNAVAILABLE", reason: "Data faktual Rates & Policy sedang tidak dapat dibaca." };
  }
}
