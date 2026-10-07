import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

const DAY = 24 * 60 * 60 * 1000;

const DEFINITIONS = [
  {
    seriesKey: "BAMLH0A0HYM2",
    domain: "MACRO",
    valueUnit: "PERCENT",
    changeUnit: "BPS",
  },
  {
    seriesKey: "BAMLC0A0CM",
    domain: "MACRO",
    valueUnit: "PERCENT",
    changeUnit: "BPS",
  },
  {
    seriesKey: "VIXCLS",
    domain: "ASSET",
    valueUnit: "INDEX",
    changeUnit: "INDEX_POINTS",
  },
  {
    seriesKey: "T10Y2Y",
    domain: "MACRO",
    valueUnit: "PERCENT",
    changeUnit: "BPS",
  },
] as const;

export type CreditFinancialConditionsSeriesKey =
  (typeof DEFINITIONS)[number]["seriesKey"];
export type CreditFinancialConditionsValueUnit = "PERCENT" | "INDEX";
export type CreditFinancialConditionsChangeUnit = "BPS" | "INDEX_POINTS";

export type CreditFinancialConditionsPoint = {
  seriesKey: CreditFinancialConditionsSeriesKey;
  value: number;
  valueUnit: CreditFinancialConditionsValueUnit;
  observedAt: string;
  retrievedAt: string;
  sourceId: string;
  quality: DataQuality;
  change1d: number | null;
  change1dFrom: string | null;
  change1w: number | null;
  change1wFrom: string | null;
  changeUnit: CreditFinancialConditionsChangeUnit;
};

export type CreditFinancialConditionsReadModel =
  | {
      status: "OK";
      series: CreditFinancialConditionsPoint[];
      reason: string | null;
    }
  | {
      status: "UNAVAILABLE";
      reason: string;
    };

type Definition = (typeof DEFINITIONS)[number];

function semanticSeriesKey(observation: Observation): string | null {
  const seriesId = observation.metadata?.seriesId;
  if (typeof seriesId === "string" && seriesId.trim()) return seriesId;
  const metricId = observation.metadata?.metricId;
  return typeof metricId === "string" && metricId.trim() ? metricId : null;
}

function numericValue(observation: Observation | null): number | null {
  if (!observation || !observation.value.trim()) return null;
  const value = Number(observation.value);
  return Number.isFinite(value) ? value : null;
}

function latestOnOrBefore(
  rows: Observation[],
  seriesKey: CreditFinancialConditionsSeriesKey,
  at: number,
): Observation | null {
  return rows
    .filter((row) => semanticSeriesKey(row) === seriesKey && Date.parse(row.observedAt) <= at)
    .sort((a, b) =>
      Date.parse(b.observedAt) - Date.parse(a.observedAt)
      || Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt)
      || b.id.localeCompare(a.id)
    )[0] ?? null;
}

function change(
  definition: Definition,
  latestValue: number,
  predecessor: Observation | null,
): number | null {
  const predecessorValue = numericValue(predecessor);
  if (predecessorValue === null) return null;

  if (definition.changeUnit === "BPS") {
    return (latestValue - predecessorValue) * 100;
  }
  return latestValue - predecessorValue;
}

function buildPoint(
  definition: Definition,
  rows: Observation[],
  asOf: number,
): CreditFinancialConditionsPoint | null {
  const latest = latestOnOrBefore(rows, definition.seriesKey, asOf);
  const latestValue = numericValue(latest);
  if (!latest || latestValue === null) return null;

  const latestAt = Date.parse(latest.observedAt);
  if (!Number.isFinite(latestAt)) return null;

  const oneDay = latestOnOrBefore(rows, definition.seriesKey, latestAt - DAY);
  const oneWeek = latestOnOrBefore(rows, definition.seriesKey, latestAt - 7 * DAY);

  return {
    seriesKey: definition.seriesKey,
    value: latestValue,
    valueUnit: definition.valueUnit,
    observedAt: latest.observedAt,
    retrievedAt: latest.retrievedAt,
    sourceId: latest.sourceId,
    quality: latest.quality,
    change1d: change(definition, latestValue, oneDay),
    change1dFrom: oneDay?.observedAt ?? null,
    change1w: change(definition, latestValue, oneWeek),
    change1wFrom: oneWeek?.observedAt ?? null,
    changeUnit: definition.changeUnit,
  };
}

/**
 * Read-only factual Credit & Financial Conditions slice.
 *
 * The output reports observed levels, 1D/1W changes, acquisition quality and
 * provenance only. It deliberately does not classify risk-on/risk-off,
 * regime, stress thresholds, transmission, causality or trading direction.
 */
export async function buildCreditFinancialConditionsReadModel(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
): Promise<CreditFinancialConditionsReadModel> {
  const end = asOf.toISOString();
  const start = new Date(asOf.getTime() - 21 * DAY).toISOString();

  try {
    const histories = await Promise.all(DEFINITIONS.map((definition) =>
      repository.findHistory({
        identity: {
          domain: definition.domain,
          seriesKey: definition.seriesKey,
        },
        observedAtOnOrAfter: start,
        observedAtOnOrBefore: end,
        retrievedAtOnOrBefore: end,
        order: "ASC",
        limit: 100,
      })
    ));

    const points = DEFINITIONS.flatMap((definition, index) => {
      const point = buildPoint(definition, histories[index] ?? [], asOf.getTime());
      return point ? [point] : [];
    });

    if (!points.length) {
      return {
        status: "UNAVAILABLE",
        reason: "Riwayat faktual Credit & Financial Conditions belum tersedia.",
      };
    }

    return {
      status: "OK",
      series: points,
      reason: points.length === DEFINITIONS.length
        ? null
        : "Sebagian seri Credit & Financial Conditions belum tersedia pada cutoff ini.",
    };
  } catch (error) {
    console.error(
      "Credit & Financial Conditions durable read failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return {
      status: "UNAVAILABLE",
      reason: "Data faktual Credit & Financial Conditions sedang tidak dapat dibaca.",
    };
  }
}
