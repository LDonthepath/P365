import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

const DAY = 24 * 60 * 60 * 1000;
const SERIES = ["DGS2", "DGS10", "DFII10", "T10YIE", "T10Y2Y"] as const;

export type RatesSeriesKey = (typeof SERIES)[number];

export type RatesSeriesPoint = {
  seriesKey: RatesSeriesKey;
  valuePercent: number;
  observedAt: string;
  quality: DataQuality;
  change1wBps: number | null;
  change1wFrom: string | null;
  change4wBps: number | null;
  change4wFrom: string | null;
};

export type RatesInflationReadModel =
  | { status: "OK"; series: RatesSeriesPoint[] }
  | { status: "UNAVAILABLE"; reason: string };

function seriesKey(observation: Observation): string | null {
  return observation.identity?.seriesKey
    ?? (typeof observation.metadata?.seriesId === "string" ? observation.metadata.seriesId : null);
}

function latestOnOrBefore(rows: Observation[], key: RatesSeriesKey, at: number): Observation | null {
  return rows
    .filter((row) => seriesKey(row) === key && Date.parse(row.observedAt) <= at)
    .sort((a, b) =>
      Date.parse(b.observedAt) - Date.parse(a.observedAt)
      || Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt)
    )[0] ?? null;
}

function numericValue(observation: Observation | null): number | null {
  if (!observation) return null;
  const value = Number(observation.value);
  return Number.isFinite(value) ? value : null;
}

function buildPoint(rows: Observation[], key: RatesSeriesKey, asOf: number): RatesSeriesPoint | null {
  const latest = latestOnOrBefore(rows, key, asOf);
  const latestValue = numericValue(latest);
  if (!latest || latestValue === null) return null;

  const latestAt = Date.parse(latest.observedAt);
  const oneWeek = latestOnOrBefore(rows, key, latestAt - 7 * DAY);
  const fourWeeks = latestOnOrBefore(rows, key, latestAt - 28 * DAY);
  const oneWeekValue = numericValue(oneWeek);
  const fourWeeksValue = numericValue(fourWeeks);

  return {
    seriesKey: key,
    valuePercent: latestValue,
    observedAt: latest.observedAt,
    quality: latest.quality,
    change1wBps: oneWeek && oneWeekValue !== null ? (latestValue - oneWeekValue) * 100 : null,
    change1wFrom: oneWeek?.observedAt ?? null,
    change4wBps: fourWeeks && fourWeeksValue !== null ? (latestValue - fourWeeksValue) * 100 : null,
    change4wFrom: fourWeeks?.observedAt ?? null,
  };
}

export async function buildRatesInflationReadModel(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
): Promise<RatesInflationReadModel> {
  const end = asOf.toISOString();
  const start = new Date(asOf.getTime() - 45 * DAY).toISOString();

  try {
    const histories = await Promise.all(SERIES.map((key) => repository.findHistory({
      identity: { domain: "MACRO", seriesKey: key },
      observedAtOnOrAfter: start,
      observedAtOnOrBefore: end,
      retrievedAtOnOrBefore: end,
      order: "ASC",
      limit: 100,
    })));
    const rows = histories.flat();
    const points = SERIES
      .map((key) => buildPoint(rows, key, asOf.getTime()))
      .filter((point): point is RatesSeriesPoint => Boolean(point));

    if (!points.length) {
      return { status: "UNAVAILABLE", reason: "Riwayat suku bunga dan ekspektasi inflasi belum tersedia." };
    }
    return { status: "OK", series: points };
  } catch (error) {
    console.error("Rates and inflation durable read failed:", error instanceof Error ? error.message : "unknown error");
    return { status: "UNAVAILABLE", reason: "Data suku bunga dan ekspektasi inflasi sedang tidak dapat dibaca." };
  }
}
