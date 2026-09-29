import type { DataQuality, Observation, ObservationDomain } from "../domain/types";
import {
  FRESHNESS_POLICIES,
  qualityFromMarketHours,
  type MarketFreshnessCalendar,
} from "../domain/freshness";
import type { HistoricalObservationRepository } from "../repositories/types";
import {
  buildNetLiquidityReadModel,
  type NetLiquidityReadModel,
} from "./net-liquidity";
import {
  buildRatesInflationReadModel,
  type RatesInflationReadModel,
} from "./rates-inflation";

const DAY = 24 * 60 * 60 * 1000;

const MARKET_SERIES = {
  dxy: {
    seriesKey: "dxy.index.usd",
    domain: "ASSET" as ObservationDomain,
    expectedCalendar: "ICE_USDX" as MarketFreshnessCalendar,
  },
  bitcoin: {
    seriesKey: "btc.spot.usd",
    domain: "ASSET" as ObservationDomain,
    expectedCalendar: "CONTINUOUS_24_7" as MarketFreshnessCalendar,
  },
  gold: {
    seriesKey: "gold.futures.usd",
    domain: "ASSET" as ObservationDomain,
    expectedCalendar: "CME_GLOBEX_GOLD" as MarketFreshnessCalendar,
  },
} as const;

export type FactualMarketRecency = "CURRENT" | "STALE" | "UNKNOWN";

export type FactualMarketChange = {
  targetAt: string;
  predecessorValue: number;
  predecessorObservedAt: string;
  predecessorRetrievedAt: string;
  absoluteChange: number;
  percentChange: number | null;
};

export type FactualMarketSeries =
  | {
      status: "AVAILABLE";
      seriesKey: string;
      latestValue: number;
      latestObservedAt: string;
      latestRetrievedAt: string;
      acquisitionQuality: DataQuality;
      freshnessCalendar: MarketFreshnessCalendar | null;
      recency: FactualMarketRecency;
      change1d: FactualMarketChange | null;
      change1w: FactualMarketChange | null;
      change4w: FactualMarketChange | null;
    }
  | {
      status: "UNAVAILABLE";
      seriesKey: string;
      reason: string;
    };

export type MacroCryptoGoldFactualContext = {
  asOf: string;
  macro: {
    ratesInflation: RatesInflationReadModel;
    netLiquidity: NetLiquidityReadModel;
    dxy: FactualMarketSeries;
  };
  crypto: {
    bitcoin: FactualMarketSeries;
  };
  gold: FactualMarketSeries;
};

type SharedReadModels = {
  ratesInflation?: RatesInflationReadModel | Promise<RatesInflationReadModel>;
  netLiquidity?: NetLiquidityReadModel | Promise<NetLiquidityReadModel>;
};

type MarketSeriesDefinition = (typeof MARKET_SERIES)[keyof typeof MARKET_SERIES];

function numericValue(observation: Observation | null): number | null {
  if (!observation || !observation.value.trim()) return null;
  const value = Number(observation.value);
  return Number.isFinite(value) ? value : null;
}

function persistedCalendar(observation: Observation): MarketFreshnessCalendar | null {
  const value = observation.metadata?.freshnessCalendar;
  return value === "CONTINUOUS_24_7"
    || value === "CME_GLOBEX_GOLD"
    || value === "ICE_USDX"
    || value === "RUSSELL_2000_CASH_INDEX"
    ? value
    : null;
}

function currentRecency(
  observation: Observation,
  expectedCalendar: MarketFreshnessCalendar,
  asOf: string,
): { calendar: MarketFreshnessCalendar | null; recency: FactualMarketRecency } {
  const calendar = persistedCalendar(observation);
  if (!calendar || calendar !== expectedCalendar) {
    return { calendar, recency: "UNKNOWN" };
  }

  const quality = qualityFromMarketHours({
    observedAt: observation.observedAt,
    evaluatedAt: asOf,
    maxAgeMs: FRESHNESS_POLICIES.MARKET_REALTIME.maxAgeMs,
    calendar,
  });
  return {
    calendar,
    recency: quality === "FRESH" ? "CURRENT" : quality === "STALE" ? "STALE" : "UNKNOWN",
  };
}

async function pointOnOrBefore(
  repository: HistoricalObservationRepository,
  definition: MarketSeriesDefinition,
  targetAt: string,
  asOf: string,
): Promise<Observation | null> {
  const rows = await repository.findHistory({
    identity: { domain: definition.domain, seriesKey: definition.seriesKey },
    observedAtOnOrBefore: targetAt,
    retrievedAtOnOrBefore: asOf,
    order: "DESC",
    limit: 1,
  });
  return rows[0] ?? null;
}

function factualChange(
  latestValue: number,
  predecessor: Observation | null,
  targetAt: string,
): FactualMarketChange | null {
  const predecessorValue = numericValue(predecessor);
  if (!predecessor || predecessorValue === null) return null;
  const absoluteChange = latestValue - predecessorValue;
  return {
    targetAt,
    predecessorValue,
    predecessorObservedAt: predecessor.observedAt,
    predecessorRetrievedAt: predecessor.retrievedAt,
    absoluteChange,
    percentChange: predecessorValue === 0 ? null : (absoluteChange / predecessorValue) * 100,
  };
}

async function buildMarketSeries(
  repository: HistoricalObservationRepository,
  definition: MarketSeriesDefinition,
  asOf: string,
): Promise<FactualMarketSeries> {
  try {
    const latest = await pointOnOrBefore(repository, definition, asOf, asOf);
    const latestValue = numericValue(latest);
    if (!latest || latestValue === null) {
      return {
        status: "UNAVAILABLE",
        seriesKey: definition.seriesKey,
        reason: "Riwayat canonical belum memiliki observasi numerik yang tersedia pada cutoff ini.",
      };
    }

    const latestAt = Date.parse(latest.observedAt);
    if (!Number.isFinite(latestAt)) {
      return {
        status: "UNAVAILABLE",
        seriesKey: definition.seriesKey,
        reason: "Waktu observasi canonical tidak valid.",
      };
    }

    const targets = {
      oneDay: new Date(latestAt - DAY).toISOString(),
      oneWeek: new Date(latestAt - 7 * DAY).toISOString(),
      fourWeeks: new Date(latestAt - 28 * DAY).toISOString(),
    };
    const [oneDay, oneWeek, fourWeeks] = await Promise.all([
      pointOnOrBefore(repository, definition, targets.oneDay, asOf),
      pointOnOrBefore(repository, definition, targets.oneWeek, asOf),
      pointOnOrBefore(repository, definition, targets.fourWeeks, asOf),
    ]);
    const recency = currentRecency(latest, definition.expectedCalendar, asOf);

    return {
      status: "AVAILABLE",
      seriesKey: definition.seriesKey,
      latestValue,
      latestObservedAt: latest.observedAt,
      latestRetrievedAt: latest.retrievedAt,
      acquisitionQuality: latest.quality,
      freshnessCalendar: recency.calendar,
      recency: recency.recency,
      change1d: factualChange(latestValue, oneDay, targets.oneDay),
      change1w: factualChange(latestValue, oneWeek, targets.oneWeek),
      change4w: factualChange(latestValue, fourWeeks, targets.fourWeeks),
    };
  } catch (error) {
    console.error(
      `Factual context read failed for ${definition.seriesKey}:`,
      error instanceof Error ? error.message : "unknown error",
    );
    return {
      status: "UNAVAILABLE",
      seriesKey: definition.seriesKey,
      reason: "Riwayat canonical sedang tidak dapat dibaca.",
    };
  }
}

/**
 * Builds the read-only Macro → BTC + Gold factual slice from durable canonical
 * history. Every traded-market point is a bounded point-in-time query; no
 * provider fetch, persistence write, or unbounded history scan occurs here.
 */
export async function buildMacroCryptoGoldFactualContext(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
  shared: SharedReadModels = {},
): Promise<MacroCryptoGoldFactualContext> {
  const asOfMs = asOf.getTime();
  if (!Number.isFinite(asOfMs)) throw new Error("MVP factual context requires a valid asOf cutoff.");
  const cutoff = asOf.toISOString();

  const ratesInflationPromise = shared.ratesInflation
    ? Promise.resolve(shared.ratesInflation)
    : buildRatesInflationReadModel(repository, asOf);
  const netLiquidityPromise = shared.netLiquidity
    ? Promise.resolve(shared.netLiquidity)
    : buildNetLiquidityReadModel(repository, asOf);

  const [ratesInflation, netLiquidity, dxy, bitcoin, gold] = await Promise.all([
    ratesInflationPromise,
    netLiquidityPromise,
    buildMarketSeries(repository, MARKET_SERIES.dxy, cutoff),
    buildMarketSeries(repository, MARKET_SERIES.bitcoin, cutoff),
    buildMarketSeries(repository, MARKET_SERIES.gold, cutoff),
  ]);

  return {
    asOf: cutoff,
    macro: { ratesInflation, netLiquidity, dxy },
    crypto: { bitcoin },
    gold,
  };
}
