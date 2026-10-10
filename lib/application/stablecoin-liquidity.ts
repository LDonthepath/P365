import { qualityFromDailyUtcCadence } from "../domain/freshness";
import { USD_STABLECOIN_MARKET_CAP_SERIES_KEY } from "../domain/observation-semantics";
import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type StablecoinLiquidityRecency = "CURRENT" | "STALE" | "UNKNOWN";

export type StablecoinLiquidityPoint = {
  sourceId?: string;
  value: number;
  observedAt: string;
  retrievedAt: string;
  acquisitionQuality: DataQuality;
};

export type StablecoinLiquidityChange = {
  targetAt: string;
  predecessor: StablecoinLiquidityPoint;
  absoluteChange: number;
  percentChange: number | null;
};

export type StablecoinLiquidityReadModel = {
  asOf: string;
  seriesKey: typeof USD_STABLECOIN_MARKET_CAP_SERIES_KEY;
  latest: (StablecoinLiquidityPoint & { recency: StablecoinLiquidityRecency }) | null;
  change1d: StablecoinLiquidityChange | null;
  change1w: StablecoinLiquidityChange | null;
  change4w: StablecoinLiquidityChange | null;
};

function numericPoint(observation: Observation | null): StablecoinLiquidityPoint | null {
  if (!observation || !observation.value.trim()) return null;
  const value = Number(observation.value);
  if (!Number.isFinite(value)) return null;
  return {
    value,
    sourceId: observation.sourceId,
    observedAt: observation.observedAt,
    retrievedAt: observation.retrievedAt,
    acquisitionQuality: observation.quality,
  };
}

async function pointOnOrBefore(
  repository: HistoricalObservationRepository,
  targetAt: string,
  asOf: string,
): Promise<Observation | null> {
  const observations = await repository.findHistory({
    identity: { domain: "MARKET", seriesKey: USD_STABLECOIN_MARKET_CAP_SERIES_KEY },
    observedAtOnOrBefore: targetAt,
    retrievedAtOnOrBefore: asOf,
    order: "DESC",
    limit: 1,
  });
  return observations[0] ?? null;
}

function changeFrom(
  latestValue: number,
  observation: Observation | null,
  targetAt: string,
): StablecoinLiquidityChange | null {
  const predecessor = numericPoint(observation);
  if (!predecessor) return null;
  const absoluteChange = latestValue - predecessor.value;
  return {
    targetAt,
    predecessor,
    absoluteChange,
    percentChange: predecessor.value === 0 ? null : (absoluteChange / predecessor.value) * 100,
  };
}

function readRecency(observedAt: string, asOf: string): StablecoinLiquidityRecency {
  const quality = qualityFromDailyUtcCadence({ observedAt, evaluatedAt: asOf });
  return quality === "FRESH" ? "CURRENT" : quality === "STALE" ? "STALE" : "UNKNOWN";
}

/**
 * Builds a factual point-in-time view from four bounded durable-history
 * queries. It never fetches a provider or scans a four-week range.
 */
export async function buildStablecoinLiquidityReadModel(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
): Promise<StablecoinLiquidityReadModel> {
  const asOfMs = asOf.getTime();
  if (!Number.isFinite(asOfMs)) throw new Error("Stablecoin liquidity read model requires a valid asOf cutoff.");
  const cutoff = asOf.toISOString();
  const latestObservation = await pointOnOrBefore(repository, cutoff, cutoff);
  const latestPoint = numericPoint(latestObservation);
  if (!latestObservation || !latestPoint) {
    return {
      asOf: cutoff,
      seriesKey: USD_STABLECOIN_MARKET_CAP_SERIES_KEY,
      latest: null,
      change1d: null,
      change1w: null,
      change4w: null,
    };
  }

  const latestAtMs = Date.parse(latestObservation.observedAt);
  if (!Number.isFinite(latestAtMs)) throw new Error("Stablecoin latest observation timestamp is invalid.");
  const targets = {
    oneDay: new Date(latestAtMs - DAY_MS).toISOString(),
    oneWeek: new Date(latestAtMs - 7 * DAY_MS).toISOString(),
    fourWeeks: new Date(latestAtMs - 28 * DAY_MS).toISOString(),
  };
  const [oneDay, oneWeek, fourWeeks] = await Promise.all([
    pointOnOrBefore(repository, targets.oneDay, cutoff),
    pointOnOrBefore(repository, targets.oneWeek, cutoff),
    pointOnOrBefore(repository, targets.fourWeeks, cutoff),
  ]);

  return {
    asOf: cutoff,
    seriesKey: USD_STABLECOIN_MARKET_CAP_SERIES_KEY,
    latest: { ...latestPoint, recency: readRecency(latestObservation.observedAt, cutoff) },
    change1d: changeFrom(latestPoint.value, oneDay, targets.oneDay),
    change1w: changeFrom(latestPoint.value, oneWeek, targets.oneWeek),
    change4w: changeFrom(latestPoint.value, fourWeeks, targets.fourWeeks),
  };
}
