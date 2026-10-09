import { MACRO_SERIES_REGISTRY, type MacroSeriesDefinition } from "../data/macro-registry";
import { qualityFromMacroCadence } from "../domain/freshness";
import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

const DAY = 24 * 60 * 60 * 1000;
const FOUR_WEEKS = 28 * DAY;

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
  { seriesKey: "NFCI", domain: "MACRO", valueUnit: "INDEX", changeUnit: "INDEX_POINTS" },
  { seriesKey: "ANFCI", domain: "MACRO", valueUnit: "INDEX", changeUnit: "INDEX_POINTS" },
] as const;

export type CreditFinancialConditionsSeriesKey =
  (typeof DEFINITIONS)[number]["seriesKey"];
export type CreditFinancialConditionsValueUnit = "PERCENT" | "INDEX";
export type CreditFinancialConditionsChangeUnit = "BPS" | "INDEX_POINTS";

export type CreditFinancialConditionsChange = {
  targetAt: string;
  predecessorObservationId: string;
  predecessorValue: number;
  predecessorObservedAt: string;
  predecessorRetrievedAt: string;
  targetGapMs: number;
  value: number;
};

export type CreditFinancialConditionsPoint = {
  seriesKey: CreditFinancialConditionsSeriesKey;
  observationId: string;
  value: number;
  valueUnit: CreditFinancialConditionsValueUnit;
  cadence: "DAILY" | "WEEKLY";
  observedAt: string;
  retrievedAt: string;
  sourceId: string;
  acquisitionQuality: DataQuality;
  freshness: DataQuality;
  change1d: CreditFinancialConditionsChange | null;
  change1w: CreditFinancialConditionsChange | null;
  change4w: CreditFinancialConditionsChange | null;
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

function registryDefinition(
  seriesKey: CreditFinancialConditionsSeriesKey,
): MacroSeriesDefinition | null {
  return MACRO_SERIES_REGISTRY.find((item) => item.seriesId === seriesKey) ?? null;
}

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

function cadenceFreshness(
  observation: Observation,
  definition: MacroSeriesDefinition,
  evaluatedAt: string,
): DataQuality {
  return qualityFromMacroCadence({
    observationDate: observation.observedAt.slice(0, 10),
    frequency: definition.frequency,
    toleranceMs: definition.freshnessMs,
    evaluatedAt,
  });
}

function qualifiedChange(
  definition: Definition,
  registry: MacroSeriesDefinition,
  latestValue: number,
  predecessor: Observation | null,
  targetAtMs: number,
): CreditFinancialConditionsChange | null {
  const predecessorValue = numericValue(predecessor);
  if (!predecessor || predecessorValue === null) return null;

  const targetAt = new Date(targetAtMs).toISOString();
  if (cadenceFreshness(predecessor, registry, targetAt) !== "FRESH") return null;

  const predecessorAt = Date.parse(predecessor.observedAt);
  if (!Number.isFinite(predecessorAt) || predecessorAt > targetAtMs) return null;

  const raw = latestValue - predecessorValue;
  return {
    targetAt,
    predecessorObservationId: predecessor.id,
    predecessorValue,
    predecessorObservedAt: predecessor.observedAt,
    predecessorRetrievedAt: predecessor.retrievedAt,
    targetGapMs: targetAtMs - predecessorAt,
    value: definition.changeUnit === "BPS" ? raw * 100 : raw,
  };
}

function buildPoint(
  definition: Definition,
  rows: Observation[],
  asOf: number,
): CreditFinancialConditionsPoint | null {
  const registry = registryDefinition(definition.seriesKey);
  if (!registry) return null;

  const latest = latestOnOrBefore(rows, definition.seriesKey, asOf);
  const latestValue = numericValue(latest);
  if (!latest || latestValue === null) return null;

  const latestAt = Date.parse(latest.observedAt);
  if (!Number.isFinite(latestAt)) return null;

  const oneDayTarget = latestAt - DAY;
  const oneWeekTarget = latestAt - 7 * DAY;
  const fourWeeksTarget = latestAt - FOUR_WEEKS;
  const oneDay = latestOnOrBefore(rows, definition.seriesKey, oneDayTarget);
  const oneWeek = latestOnOrBefore(rows, definition.seriesKey, oneWeekTarget);
  const fourWeeks = latestOnOrBefore(rows, definition.seriesKey, fourWeeksTarget);

  return {
    seriesKey: definition.seriesKey,
    observationId: latest.id,
    value: latestValue,
    valueUnit: definition.valueUnit,
    cadence: registry.frequency === "WEEKLY" ? "WEEKLY" : "DAILY",
    observedAt: latest.observedAt,
    retrievedAt: latest.retrievedAt,
    sourceId: latest.sourceId,
    acquisitionQuality: latest.quality,
    freshness: cadenceFreshness(latest, registry, new Date(asOf).toISOString()),
    change1d: registry.frequency === "WEEKLY"
      ? null
      : qualifiedChange(definition, registry, latestValue, oneDay, oneDayTarget),
    change1w: qualifiedChange(definition, registry, latestValue, oneWeek, oneWeekTarget),
    change4w: qualifiedChange(definition, registry, latestValue, fourWeeks, fourWeeksTarget),
    changeUnit: definition.changeUnit,
  };
}

/**
 * Read-only factual Credit & Financial Conditions slice.
 *
 * Scope includes HY OAS, IG OAS, VIX, and weekly Chicago Fed NFCI/ANFCI.
 * T10Y2Y remains in Rates & Policy. Weekly indexes never emit a 1D
 * change; the dashboard uses their 1W comparison instead.
 *
 * Comparison endpoints reuse the registry-backed FRED cadence freshness policy
 * at each target horizon. The latest point also recomputes freshness at the
 * dashboard cutoff; stored acquisition quality is retained separately.
 * No new gap threshold, regime, risk-on/risk-off, causality or trading
 * semantics are introduced.
 */
export async function buildCreditFinancialConditionsReadModel(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
): Promise<CreditFinancialConditionsReadModel> {
  const end = asOf.toISOString();
  const maxFreshnessMs = Math.max(
    ...DEFINITIONS.map((definition) => registryDefinition(definition.seriesKey)?.freshnessMs ?? 0),
  );
  // Allow the latest daily point itself to be as old as its qualified
  // freshness window and still reach a qualified 4W predecessor.
  const start = new Date(
    asOf.getTime() - FOUR_WEEKS - (2 * maxFreshnessMs),
  ).toISOString();

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
