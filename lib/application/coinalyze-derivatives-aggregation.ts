import { createHash } from "node:crypto";
import type {
  CoinalyzeHistorySeries,
  CoinalyzeLiquidationPoint,
  CoinalyzeOhlcPoint,
} from "../data/coinalyze-derivatives";

export type CoinalyzeAggregateCoverage = "COMPLETE" | "PARTIAL" | "EMPTY";

export type CoinalyzeAggregateLineage = {
  /** Beginning of the Coinalyze interval. */
  providerTimestamp: number;
  /** End of the 5m interval; earliest safe canonical observedAt for interval-close/flow facts. */
  intervalEndTimestamp: number;
  universeSymbols: string[];
  includedSymbols: string[];
  missingSymbols: string[];
  universeHash: string;
  coverage: CoinalyzeAggregateCoverage;
};

export type CoinalyzeOpenInterestAggregate = CoinalyzeAggregateLineage & {
  totalOpenInterestUsd: number | null;
};

export type CoinalyzeFundingAggregate = CoinalyzeAggregateLineage & {
  oiWeightedFundingRatePercent: number | null;
  totalWeightOpenInterestUsd: number;
};

export type CoinalyzeLiquidationProviderFieldAggregate = CoinalyzeAggregateLineage & {
  longLiquidationUsd: number | null;
  shortLiquidationUsd: number | null;
};

function normalizedUniverse(symbols: readonly string[]): string[] {
  const normalized = symbols.map((symbol) => symbol.trim());
  if (normalized.length === 0 || normalized.some((symbol) => !symbol)) {
    throw new Error("Coinalyze aggregate requires a non-empty symbol universe");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Coinalyze aggregate universe symbols must be unique");
  }
  return [...normalized].sort();
}

function hashUniverse(symbols: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify([...symbols].sort()), "utf8").digest("hex");
}

function rowAt<T extends { providerTimestamp: number }>(
  series: CoinalyzeHistorySeries<T> | undefined,
  providerTimestamp: number,
): T | undefined {
  return series?.history.find((point) => point.providerTimestamp === providerTimestamp);
}

function seriesMap<T>(series: readonly CoinalyzeHistorySeries<T>[]): Map<string, CoinalyzeHistorySeries<T>> {
  const map = new Map<string, CoinalyzeHistorySeries<T>>();
  for (const item of series) {
    if (map.has(item.symbol)) throw new Error(`Duplicate Coinalyze aggregate series: ${item.symbol}`);
    map.set(item.symbol, item);
  }
  return map;
}

function lineage(
  providerTimestamp: number,
  universeSymbols: string[],
  includedSymbols: string[],
): CoinalyzeAggregateLineage {
  if (!Number.isInteger(providerTimestamp) || providerTimestamp < 0) {
    throw new Error("Coinalyze aggregate providerTimestamp must be a non-negative integer");
  }
  const included = [...includedSymbols].sort();
  const includedSet = new Set(included);
  const missing = universeSymbols.filter((symbol) => !includedSet.has(symbol));
  return {
    providerTimestamp,
    intervalEndTimestamp: providerTimestamp + 300,
    universeSymbols,
    includedSymbols: included,
    missingSymbols: missing,
    universeHash: hashUniverse(universeSymbols),
    coverage: included.length === 0
      ? "EMPTY"
      : missing.length === 0
        ? "COMPLETE"
        : "PARTIAL",
  };
}

export function aggregateCoinalyzeOpenInterestUsd(input: {
  universeSymbols: string[];
  providerTimestamp: number;
  openInterest: CoinalyzeHistorySeries<CoinalyzeOhlcPoint>[];
}): CoinalyzeOpenInterestAggregate {
  const universe = normalizedUniverse(input.universeSymbols);
  const bySymbol = seriesMap(input.openInterest);
  const included: string[] = [];
  let total = 0;
  for (const symbol of universe) {
    const point = rowAt(bySymbol.get(symbol), input.providerTimestamp);
    if (!point) continue;
    if (!Number.isFinite(point.close) || point.close < 0) {
      throw new Error(`Invalid Coinalyze OI close for ${symbol}`);
    }
    included.push(symbol);
    total += point.close;
  }
  return {
    ...lineage(input.providerTimestamp, universe, included),
    totalOpenInterestUsd: included.length > 0 ? total : null,
  };
}

export function aggregateCoinalyzeOiWeightedFunding(input: {
  universeSymbols: string[];
  providerTimestamp: number;
  openInterest: CoinalyzeHistorySeries<CoinalyzeOhlcPoint>[];
  funding: CoinalyzeHistorySeries<CoinalyzeOhlcPoint>[];
}): CoinalyzeFundingAggregate {
  const universe = normalizedUniverse(input.universeSymbols);
  const oiBySymbol = seriesMap(input.openInterest);
  const fundingBySymbol = seriesMap(input.funding);
  const included: string[] = [];
  let weighted = 0;
  let totalWeight = 0;
  for (const symbol of universe) {
    const oi = rowAt(oiBySymbol.get(symbol), input.providerTimestamp);
    const funding = rowAt(fundingBySymbol.get(symbol), input.providerTimestamp);
    if (!oi || !funding) continue;
    if (!Number.isFinite(oi.close) || oi.close < 0 || !Number.isFinite(funding.close)) {
      throw new Error(`Invalid Coinalyze funding inputs for ${symbol}`);
    }
    if (oi.close === 0) continue;
    included.push(symbol);
    weighted += funding.close * oi.close;
    totalWeight += oi.close;
  }
  return {
    ...lineage(input.providerTimestamp, universe, included),
    oiWeightedFundingRatePercent: totalWeight > 0 ? weighted / totalWeight : null,
    totalWeightOpenInterestUsd: totalWeight,
  };
}

/** Coinalyze OpenAPI defines l=longs liquidation volume and s=shorts liquidation volume. */
export function aggregateCoinalyzeLiquidationProviderFields(input: {
  universeSymbols: string[];
  providerTimestamp: number;
  liquidation: CoinalyzeHistorySeries<CoinalyzeLiquidationPoint>[];
}): CoinalyzeLiquidationProviderFieldAggregate {
  const universe = normalizedUniverse(input.universeSymbols);
  const bySymbol = seriesMap(input.liquidation);
  const included: string[] = [];
  let fieldL = 0;
  let fieldS = 0;
  for (const symbol of universe) {
    const point = rowAt(bySymbol.get(symbol), input.providerTimestamp);
    if (!point) continue;
    if (
      !Number.isFinite(point.longLiquidationUsd)
      || point.longLiquidationUsd < 0
      || !Number.isFinite(point.shortLiquidationUsd)
      || point.shortLiquidationUsd < 0
    ) {
      throw new Error(`Invalid Coinalyze liquidation fields for ${symbol}`);
    }
    included.push(symbol);
    fieldL += point.longLiquidationUsd;
    fieldS += point.shortLiquidationUsd;
  }
  return {
    ...lineage(input.providerTimestamp, universe, included),
    longLiquidationUsd: included.length > 0 ? fieldL : null,
    shortLiquidationUsd: included.length > 0 ? fieldS : null,
  };
}
