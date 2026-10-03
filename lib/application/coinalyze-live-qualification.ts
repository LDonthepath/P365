import {
  eligibleCoinalyzeBtcPerpetualMarkets,
  fetchCoinalyzeFundingRateHistory,
  fetchCoinalyzeFutureMarkets,
  fetchCoinalyzeLiquidationHistory,
  fetchCoinalyzeOhlcvHistory,
  fetchCoinalyzeOpenInterestHistory,
  COINALYZE_INTERVAL_SECONDS,
  coinalyzeCompletedIntervalEndTimestamp,
  isCoinalyzeIntervalComplete,
  type CoinalyzeFutureMarket,
  type CoinalyzeHistoryQuery,
  type CoinalyzeHistorySeries,
  type CoinalyzeLiquidationPoint,
  type CoinalyzeOhlcPoint,
  type CoinalyzeOhlcvPoint,
} from "../data/coinalyze-derivatives";
import type { ProviderResult } from "../data/types";
import {
  aggregateCoinalyzeOiWeightedFunding,
  aggregateCoinalyzeOpenInterestUsd,
} from "./coinalyze-derivatives-aggregation";

const FIVE_MINUTES_SECONDS = 5 * 60;
const QUALIFICATION_LOOKBACK_SECONDS = 45 * 60;
const MAX_SAMPLE_SYMBOLS = 5;
const PROVIDER_CALLS_PER_MINUTE = 40;
const EVIDENCE_FAMILY_COUNT = 4;

export type CoinalyzeQualificationStatus =
  | "BLOCKED_NO_API_KEY"
  | "FAILED"
  | "READY_FOR_SEMANTIC_REVIEW";

export type CoinalyzeTimestampEvidence = {
  family: "OPEN_INTEREST" | "FUNDING" | "LIQUIDATION" | "OHLCV";
  requestedSymbols: number;
  returnedSymbols: number;
  missingSymbols: string[];
  pointCount: number;
  distinctTimestamps: number;
  firstProviderTimestamp: number | null;
  latestReturnedProviderTimestamp: number | null;
  latestCompletedProviderTimestamp: number | null;
  latestCompletedObservedAt: string | null;
  latestCompletedLagSeconds: number | null;
  includesIncompleteCurrentBucket: boolean;
  allAlignedToFiveMinuteBoundary: boolean;
};

export type CoinalyzeLiveQualificationReport = {
  status: CoinalyzeQualificationStatus;
  evaluatedAt: string;
  source: "coinalyze";
  writesPerformed: false;
  universe: {
    eligibleCount: number;
    exchanges: string[];
    symbols: string[];
    sampleSymbols: string[];
    symbolCallsPerFiveMinuteCycle: number;
    theoreticalFiveMinuteCapacity: number;
    completeCycleFitsTheoreticalLimit: boolean;
    completeCycleFitsSingleMinuteBurst: boolean;
  } | null;
  provider: {
    futureMarkets: ProviderResult<CoinalyzeFutureMarket>["status"];
    openInterest: ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcPoint>>["status"] | null;
    funding: ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcPoint>>["status"] | null;
    liquidation: ProviderResult<CoinalyzeHistorySeries<CoinalyzeLiquidationPoint>>["status"] | null;
    ohlcv: ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcvPoint>>["status"] | null;
  };
  timestamps: CoinalyzeTimestampEvidence[];
  sampleAggregates: {
    providerIntervalStartTimestamp: number;
    observedAt: string;
    openInterestUsd: number | null;
    openInterestCoverage: "COMPLETE" | "PARTIAL" | "EMPTY";
    oiWeightedFundingRatePercent: number | null;
    fundingCoverage: "COMPLETE" | "PARTIAL" | "EMPTY";
  } | null;
  semantics: {
    providerTimestamp: "INTERVAL_START";
    liquidationL: "LONGS_LIQUIDATION_VOLUME";
    liquidationS: "SHORTS_LIQUIDATION_VOLUME";
  };
  unresolved: Array<"DURABLE_PRIVATE_STORAGE_USE">;
  message?: string;
};

type QualificationProvider = {
  futureMarkets: () => Promise<ProviderResult<CoinalyzeFutureMarket>>;
  openInterest: (query: CoinalyzeHistoryQuery) => Promise<ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcPoint>>>;
  funding: (query: CoinalyzeHistoryQuery) => Promise<ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcPoint>>>;
  liquidation: (query: CoinalyzeHistoryQuery) => Promise<ProviderResult<CoinalyzeHistorySeries<CoinalyzeLiquidationPoint>>>;
  ohlcv: (query: CoinalyzeHistoryQuery) => Promise<ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcvPoint>>>;
};

type QualificationDependencies = {
  now?: () => Date;
  provider?: QualificationProvider;
};

const defaultProvider: QualificationProvider = {
  futureMarkets: () => fetchCoinalyzeFutureMarkets(),
  openInterest: (query) => fetchCoinalyzeOpenInterestHistory(query),
  funding: (query) => fetchCoinalyzeFundingRateHistory(query),
  liquidation: (query) => fetchCoinalyzeLiquidationHistory(query),
  ohlcv: (query) => fetchCoinalyzeOhlcvHistory(query),
};

function deterministicSample(markets: CoinalyzeFutureMarket[]): string[] {
  const byExchange = new Map<string, CoinalyzeFutureMarket[]>();
  for (const market of markets) {
    const items = byExchange.get(market.exchange) ?? [];
    items.push(market);
    byExchange.set(market.exchange, items);
  }

  const sample: string[] = [];
  for (const exchange of [...byExchange.keys()].sort()) {
    const candidate = [...(byExchange.get(exchange) ?? [])].sort((left, right) =>
      left.symbol.localeCompare(right.symbol),
    )[0];
    if (candidate) sample.push(candidate.symbol);
    if (sample.length >= MAX_SAMPLE_SYMBOLS) break;
  }

  if (sample.length < Math.min(MAX_SAMPLE_SYMBOLS, markets.length)) {
    for (const market of [...markets].sort((left, right) => left.symbol.localeCompare(right.symbol))) {
      if (!sample.includes(market.symbol)) sample.push(market.symbol);
      if (sample.length >= MAX_SAMPLE_SYMBOLS) break;
    }
  }

  return sample;
}

function allTimestamps<T extends { providerTimestamp: number }>(
  series: CoinalyzeHistorySeries<T>[],
): number[] {
  return series.flatMap((item) => item.history.map((point) => point.providerTimestamp));
}

function timestampEvidence<T extends { providerTimestamp: number }>(
  family: CoinalyzeTimestampEvidence["family"],
  requestedSymbols: string[],
  series: CoinalyzeHistorySeries<T>[],
  nowSeconds: number,
): CoinalyzeTimestampEvidence {
  const timestamps = allTimestamps(series);
  const distinct = [...new Set(timestamps)].sort((left, right) => left - right);
  const first = distinct[0] ?? null;
  const latestReturned = distinct.at(-1) ?? null;
  const completed = distinct.filter((timestamp) => isCoinalyzeIntervalComplete(timestamp, nowSeconds));
  const latestCompleted = completed.at(-1) ?? null;
  const returned = new Set(series.map((item) => item.symbol));
  return {
    family,
    requestedSymbols: requestedSymbols.length,
    returnedSymbols: returned.size,
    missingSymbols: requestedSymbols.filter((symbol) => !returned.has(symbol)),
    pointCount: timestamps.length,
    distinctTimestamps: distinct.length,
    firstProviderTimestamp: first,
    latestReturnedProviderTimestamp: latestReturned,
    latestCompletedProviderTimestamp: latestCompleted,
    latestCompletedObservedAt: latestCompleted === null
      ? null
      : new Date(coinalyzeCompletedIntervalEndTimestamp(latestCompleted) * 1000).toISOString(),
    latestCompletedLagSeconds: latestCompleted === null
      ? null
      : Math.max(0, nowSeconds - coinalyzeCompletedIntervalEndTimestamp(latestCompleted)),
    includesIncompleteCurrentBucket: latestReturned !== null
      && !isCoinalyzeIntervalComplete(latestReturned, nowSeconds),
    allAlignedToFiveMinuteBoundary: timestamps.length > 0
      && timestamps.every((timestamp) => timestamp % FIVE_MINUTES_SECONDS === 0),
  };
}

function latestSharedCompletedTimestamp(
  openInterest: CoinalyzeHistorySeries<CoinalyzeOhlcPoint>[],
  funding: CoinalyzeHistorySeries<CoinalyzeOhlcPoint>[],
  nowSeconds: number,
): number | null {
  const oi = new Set(allTimestamps(openInterest));
  const shared = [...new Set(allTimestamps(funding))]
    .filter((timestamp) => oi.has(timestamp) && isCoinalyzeIntervalComplete(timestamp, nowSeconds))
    .sort((left, right) => left - right);
  return shared.at(-1) ?? null;
}

function providerFailureMessage(results: Array<{
  name: string;
  result: ProviderResult<unknown>;
  emptyAllowed?: boolean;
}>): string | undefined {
  const failures = results
    .filter(({ result, emptyAllowed }) =>
      result.status === "ERROR"
      || result.status === "UNAVAILABLE"
      || (result.status === "EMPTY" && !emptyAllowed))
    .map(({ name, result }) => `${name}=${result.status}${result.message ? `(${result.message})` : ""}`);
  return failures.length > 0 ? failures.join("; ") : undefined;
}

export async function runCoinalyzeLiveQualification(
  dependencies: QualificationDependencies = {},
): Promise<CoinalyzeLiveQualificationReport> {
  const now = dependencies.now ?? (() => new Date());
  const provider = dependencies.provider ?? defaultProvider;
  const evaluated = now();
  const evaluatedAt = evaluated.toISOString();
  const nowSeconds = Math.floor(evaluated.getTime() / 1000);

  const futureMarkets = await provider.futureMarkets();
  if (futureMarkets.status === "UNAVAILABLE" && futureMarkets.errorCode === "CONFIGURATION") {
    return {
      status: "BLOCKED_NO_API_KEY",
      evaluatedAt,
      source: "coinalyze",
      writesPerformed: false,
      universe: null,
      provider: {
        futureMarkets: futureMarkets.status,
        openInterest: null,
        funding: null,
        liquidation: null,
        ohlcv: null,
      },
      timestamps: [],
      sampleAggregates: null,
      semantics: {
        providerTimestamp: "INTERVAL_START",
        liquidationL: "LONGS_LIQUIDATION_VOLUME",
        liquidationS: "SHORTS_LIQUIDATION_VOLUME",
      },
      unresolved: ["DURABLE_PRIVATE_STORAGE_USE"],
      message: futureMarkets.message,
    };
  }

  if (futureMarkets.status !== "SUCCESS") {
    return {
      status: "FAILED",
      evaluatedAt,
      source: "coinalyze",
      writesPerformed: false,
      universe: null,
      provider: {
        futureMarkets: futureMarkets.status,
        openInterest: null,
        funding: null,
        liquidation: null,
        ohlcv: null,
      },
      timestamps: [],
      sampleAggregates: null,
      semantics: {
        providerTimestamp: "INTERVAL_START",
        liquidationL: "LONGS_LIQUIDATION_VOLUME",
        liquidationS: "SHORTS_LIQUIDATION_VOLUME",
      },
      unresolved: ["DURABLE_PRIVATE_STORAGE_USE"],
      message: futureMarkets.message ?? "Coinalyze future-markets qualification failed",
    };
  }

  const eligible = eligibleCoinalyzeBtcPerpetualMarkets(futureMarkets.data);
  if (eligible.length === 0) {
    return {
      status: "FAILED",
      evaluatedAt,
      source: "coinalyze",
      writesPerformed: false,
      universe: {
        eligibleCount: 0,
        exchanges: [],
        symbols: [],
        sampleSymbols: [],
        symbolCallsPerFiveMinuteCycle: 0,
        theoreticalFiveMinuteCapacity: PROVIDER_CALLS_PER_MINUTE * 5,
        completeCycleFitsTheoreticalLimit: false,
        completeCycleFitsSingleMinuteBurst: false,
      },
      provider: {
        futureMarkets: futureMarkets.status,
        openInterest: null,
        funding: null,
        liquidation: null,
        ohlcv: null,
      },
      timestamps: [],
      sampleAggregates: null,
      semantics: {
        providerTimestamp: "INTERVAL_START",
        liquidationL: "LONGS_LIQUIDATION_VOLUME",
        liquidationS: "SHORTS_LIQUIDATION_VOLUME",
      },
      unresolved: ["DURABLE_PRIVATE_STORAGE_USE"],
      message: "Coinalyze returned no eligible BTC perpetual markets",
    };
  }

  const symbols = eligible.map((market) => market.symbol);
  const sampleSymbols = deterministicSample(eligible);
  const query: CoinalyzeHistoryQuery = {
    symbols: sampleSymbols,
    from: Math.max(0, nowSeconds - QUALIFICATION_LOOKBACK_SECONDS),
    to: nowSeconds,
    acquisitionMode: "FRESH",
  };

  const [openInterest, funding, liquidation, ohlcv] = await Promise.all([
    provider.openInterest(query),
    provider.funding(query),
    provider.liquidation(query),
    provider.ohlcv(query),
  ]);

  const universe = {
    eligibleCount: eligible.length,
    exchanges: [...new Set(eligible.map((market) => market.exchange))].sort(),
    symbols,
    sampleSymbols,
    symbolCallsPerFiveMinuteCycle: EVIDENCE_FAMILY_COUNT * eligible.length,
    theoreticalFiveMinuteCapacity: PROVIDER_CALLS_PER_MINUTE * 5,
    completeCycleFitsTheoreticalLimit: EVIDENCE_FAMILY_COUNT * eligible.length <= PROVIDER_CALLS_PER_MINUTE * 5,
    completeCycleFitsSingleMinuteBurst: EVIDENCE_FAMILY_COUNT * eligible.length <= PROVIDER_CALLS_PER_MINUTE,
  };

  const failure = providerFailureMessage([
    { name: "openInterest", result: openInterest as ProviderResult<unknown> },
    { name: "funding", result: funding as ProviderResult<unknown> },
    { name: "liquidation", result: liquidation as ProviderResult<unknown>, emptyAllowed: true },
    { name: "ohlcv", result: ohlcv as ProviderResult<unknown> },
  ]);

  if (failure) {
    return {
      status: "FAILED",
      evaluatedAt,
      source: "coinalyze",
      writesPerformed: false,
      universe,
      provider: {
        futureMarkets: futureMarkets.status,
        openInterest: openInterest.status,
        funding: funding.status,
        liquidation: liquidation.status,
        ohlcv: ohlcv.status,
      },
      timestamps: [],
      sampleAggregates: null,
      semantics: {
        providerTimestamp: "INTERVAL_START",
        liquidationL: "LONGS_LIQUIDATION_VOLUME",
        liquidationS: "SHORTS_LIQUIDATION_VOLUME",
      },
      unresolved: ["DURABLE_PRIVATE_STORAGE_USE"],
      message: failure,
    };
  }

  const timestamps = [
    timestampEvidence("OPEN_INTEREST", sampleSymbols, openInterest.data, nowSeconds),
    timestampEvidence("FUNDING", sampleSymbols, funding.data, nowSeconds),
    timestampEvidence("LIQUIDATION", sampleSymbols, liquidation.data, nowSeconds),
    timestampEvidence("OHLCV", sampleSymbols, ohlcv.data, nowSeconds),
  ];

  const sharedTimestamp = latestSharedCompletedTimestamp(openInterest.data, funding.data, nowSeconds);
  const sampleAggregates = sharedTimestamp === null
    ? null
    : (() => {
      const oi = aggregateCoinalyzeOpenInterestUsd({
        universeSymbols: sampleSymbols,
        providerTimestamp: sharedTimestamp,
        openInterest: openInterest.data,
      });
      const weightedFunding = aggregateCoinalyzeOiWeightedFunding({
        universeSymbols: sampleSymbols,
        providerTimestamp: sharedTimestamp,
        openInterest: openInterest.data,
        funding: funding.data,
      });
      return {
        providerIntervalStartTimestamp: sharedTimestamp,
        observedAt: new Date(coinalyzeCompletedIntervalEndTimestamp(sharedTimestamp) * 1000).toISOString(),
        openInterestUsd: oi.totalOpenInterestUsd,
        openInterestCoverage: oi.coverage,
        oiWeightedFundingRatePercent: weightedFunding.oiWeightedFundingRatePercent,
        fundingCoverage: weightedFunding.coverage,
      };
    })();

  return {
    status: "READY_FOR_SEMANTIC_REVIEW",
    evaluatedAt,
    source: "coinalyze",
    writesPerformed: false,
    universe,
    provider: {
      futureMarkets: futureMarkets.status,
      openInterest: openInterest.status,
      funding: funding.status,
      liquidation: liquidation.status,
      ohlcv: ohlcv.status,
    },
    timestamps,
    sampleAggregates,
    semantics: {
      providerTimestamp: "INTERVAL_START",
      liquidationL: "LONGS_LIQUIDATION_VOLUME",
      liquidationS: "SHORTS_LIQUIDATION_VOLUME",
    },
    unresolved: ["DURABLE_PRIVATE_STORAGE_USE"],
  };
}
