import "server-only";

import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const COINALYZE_BASE_URL = "https://api.coinalyze.net/v1" as const;
export const COINALYZE_SOURCE_ID = "coinalyze" as const;
export const COINALYZE_INTERVAL = "5min" as const;
export const COINALYZE_MAX_SYMBOLS_PER_REQUEST = 20;
export const COINALYZE_MAX_SYMBOLS_PER_OPERATION = 50;
const REQUEST_TIMEOUT_MS = 10_000;

export type CoinalyzeFutureMarket = {
  symbol: string;
  exchange: string;
  symbolOnExchange: string;
  baseAsset: string;
  quoteAsset: string;
  isPerpetual: boolean;
  margined: string;
  expireAt: number;
  denomination: string;
  hasLongShortRatioData: boolean;
  hasOhlcvData: boolean;
  hasBuySellData: boolean;
};

export type CoinalyzeOhlcPoint = {
  providerTimestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type CoinalyzeLiquidationPoint = {
  providerTimestamp: number;
  providerFieldL: number;
  providerFieldS: number;
};

export type CoinalyzeOhlcvPoint = CoinalyzeOhlcPoint & {
  volume: number;
  buyVolume: number;
  transactionCount: number;
  buyTransactionCount: number;
};

export type CoinalyzeHistorySeries<T> = {
  symbol: string;
  history: T[];
};

export type CoinalyzeHistoryQuery = {
  symbols: string[];
  from: number;
  to: number;
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
  apiKey?: () => string | undefined;
};

type HistoryKind = "open-interest" | "funding-rate" | "liquidation" | "ohlcv";

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Coinalyze malformed payload: ${label} must be a finite number`);
  }
  return value;
}

function nonNegativeNumber(value: unknown, label: string): number {
  const number = finiteNumber(value, label);
  if (number < 0) throw new Error(`Coinalyze malformed payload: ${label} must be non-negative`);
  return number;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const number = nonNegativeNumber(value, label);
  if (!Number.isInteger(number)) {
    throw new Error(`Coinalyze malformed payload: ${label} must be an integer`);
  }
  return number;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Coinalyze malformed payload: ${label} must be a non-empty string`);
  }
  return value;
}

function providerTimestamp(value: unknown, label: string): number {
  return nonNegativeInteger(value, label);
}

function parseFutureMarkets(payload: unknown): CoinalyzeFutureMarket[] {
  if (!Array.isArray(payload)) {
    throw new Error("Coinalyze malformed payload: future-markets must be an array");
  }
  const seen = new Set<string>();
  return payload.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`Coinalyze malformed payload: future-market row ${index} must be an object`);
    }
    const row = candidate as Record<string, unknown>;
    const symbol = nonEmptyString(row.symbol, `future-market[${index}].symbol`);
    if (seen.has(symbol)) {
      throw new Error(`Coinalyze malformed payload: duplicate future-market symbol ${symbol}`);
    }
    seen.add(symbol);
    if (typeof row.is_perpetual !== "boolean") {
      throw new Error(`Coinalyze malformed payload: future-market[${index}].is_perpetual must be boolean`);
    }
    for (const flag of ["has_long_short_ratio_data", "has_ohlcv_data", "has_buy_sell_data"] as const) {
      if (typeof row[flag] !== "boolean") {
        throw new Error(`Coinalyze malformed payload: future-market[${index}].${flag} must be boolean`);
      }
    }
    return {
      symbol,
      exchange: nonEmptyString(row.exchange, `future-market[${index}].exchange`),
      symbolOnExchange: nonEmptyString(row.symbol_on_exchange, `future-market[${index}].symbol_on_exchange`),
      baseAsset: nonEmptyString(row.base_asset, `future-market[${index}].base_asset`),
      quoteAsset: nonEmptyString(row.quote_asset, `future-market[${index}].quote_asset`),
      isPerpetual: row.is_perpetual,
      margined: nonEmptyString(row.margined, `future-market[${index}].margined`),
      expireAt: nonNegativeInteger(row.expire_at, `future-market[${index}].expire_at`),
      denomination: nonEmptyString(row.oi_lq_vol_denominated_in, `future-market[${index}].oi_lq_vol_denominated_in`),
      hasLongShortRatioData: row.has_long_short_ratio_data as boolean,
      hasOhlcvData: row.has_ohlcv_data as boolean,
      hasBuySellData: row.has_buy_sell_data as boolean,
    };
  });
}

function parseOhlcRow(candidate: unknown, label: string, allowNegative = false): CoinalyzeOhlcPoint {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`Coinalyze malformed payload: ${label} must be an object`);
  }
  const row = candidate as Record<string, unknown>;
  const parse = allowNegative ? finiteNumber : nonNegativeNumber;
  const point = {
    providerTimestamp: providerTimestamp(row.t, `${label}.t`),
    open: parse(row.o, `${label}.o`),
    high: parse(row.h, `${label}.h`),
    low: parse(row.l, `${label}.l`),
    close: parse(row.c, `${label}.c`),
  };
  if (point.high < Math.max(point.open, point.close, point.low) || point.low > Math.min(point.open, point.close, point.high)) {
    throw new Error(`Coinalyze malformed payload: ${label} OHLC bounds are inconsistent`);
  }
  return point;
}

function parseLiquidationRow(candidate: unknown, label: string): CoinalyzeLiquidationPoint {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`Coinalyze malformed payload: ${label} must be an object`);
  }
  const row = candidate as Record<string, unknown>;
  return {
    providerTimestamp: providerTimestamp(row.t, `${label}.t`),
    providerFieldL: nonNegativeNumber(row.l, `${label}.l`),
    providerFieldS: nonNegativeNumber(row.s, `${label}.s`),
  };
}

function parseOhlcvRow(candidate: unknown, label: string): CoinalyzeOhlcvPoint {
  const point = parseOhlcRow(candidate, label);
  const row = candidate as Record<string, unknown>;
  const volume = nonNegativeNumber(row.v, `${label}.v`);
  const buyVolume = nonNegativeNumber(row.bv, `${label}.bv`);
  const transactionCount = nonNegativeInteger(row.tx, `${label}.tx`);
  const buyTransactionCount = nonNegativeInteger(row.btx, `${label}.btx`);
  if (buyVolume > volume) {
    throw new Error(`Coinalyze malformed payload: ${label}.bv must not exceed total volume`);
  }
  if (buyTransactionCount > transactionCount) {
    throw new Error(`Coinalyze malformed payload: ${label}.btx must not exceed total transaction count`);
  }
  return { ...point, volume, buyVolume, transactionCount, buyTransactionCount };
}

function strictlyAscending<T extends { providerTimestamp: number }>(history: T[], label: string): T[] {
  for (let index = 1; index < history.length; index += 1) {
    if (history[index - 1].providerTimestamp >= history[index].providerTimestamp) {
      throw new Error(`Coinalyze malformed payload: ${label} timestamps must be strictly ascending`);
    }
  }
  return history;
}

function parseHistoryPayload<T>(
  payload: unknown,
  requestedSymbols: readonly string[],
  kind: HistoryKind,
  parsePoint: (candidate: unknown, label: string) => T,
): CoinalyzeHistorySeries<T>[] {
  if (!Array.isArray(payload)) {
    throw new Error(`Coinalyze malformed payload: ${kind} history must be an array`);
  }
  const requested = new Set(requestedSymbols);
  const seen = new Set<string>();
  const parsed = payload.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`Coinalyze malformed payload: ${kind} series ${index} must be an object`);
    }
    const row = candidate as Record<string, unknown>;
    const symbol = nonEmptyString(row.symbol, `${kind}[${index}].symbol`);
    if (!requested.has(symbol)) {
      throw new Error(`Coinalyze malformed payload: unexpected ${kind} symbol ${symbol}`);
    }
    if (seen.has(symbol)) {
      throw new Error(`Coinalyze malformed payload: duplicate ${kind} symbol ${symbol}`);
    }
    seen.add(symbol);
    if (!Array.isArray(row.history)) {
      throw new Error(`Coinalyze malformed payload: ${kind}[${index}].history must be an array`);
    }
    const history = strictlyAscending(
      row.history.map((item, pointIndex) =>
        parsePoint(item, `${kind}[${symbol}].history[${pointIndex}]`)) as Array<T & { providerTimestamp: number }>,
      `${kind}[${symbol}].history`,
    );
    return { symbol, history: history as T[] };
  });
  const missing = requestedSymbols.filter((symbol) => !seen.has(symbol));
  if (missing.length > 0) {
    throw new Error(`Coinalyze malformed payload: missing ${kind} symbols: ${missing.join(",")}`);
  }
  return parsed;
}

function validateHistoryQuery(query: CoinalyzeHistoryQuery): string[] {
  if (!Number.isInteger(query.from) || query.from < 0 || !Number.isInteger(query.to) || query.to < 0 || query.from > query.to) {
    throw new Error("Coinalyze history requires valid inclusive UNIX-second from/to bounds");
  }
  const symbols = query.symbols.map((symbol) => symbol.trim());
  if (symbols.length === 0 || symbols.some((symbol) => !symbol)) {
    throw new Error("Coinalyze history requires at least one non-empty symbol");
  }
  if (new Set(symbols).size !== symbols.length) {
    throw new Error("Coinalyze history symbols must be unique");
  }
  if (symbols.length > COINALYZE_MAX_SYMBOLS_PER_OPERATION) {
    throw new Error(`Coinalyze bounded operation supports at most ${COINALYZE_MAX_SYMBOLS_PER_OPERATION} symbols`);
  }
  return symbols;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function credentialSafeMessage(error: unknown, apiKey: string): string {
  const message = error instanceof Error ? error.message : "Coinalyze request failed";
  return apiKey ? message.split(apiKey).join("[REDACTED]") : message;
}

async function responseJson(response: Response, providerLabel: string): Promise<unknown> {
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(
      `${providerLabel} HTTP ${response.status}${retryAfter ? ` Retry-After=${retryAfter}` : ""}${detail ? `: ${detail}` : ""}`,
    );
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error(`${providerLabel} invalid JSON response`);
  }
}

function apiKey(dependencies: Dependencies): string | undefined {
  return (dependencies.apiKey ?? (() => process.env.COINALYZE_API_KEY))();
}

export function eligibleCoinalyzeBtcPerpetualMarkets(markets: CoinalyzeFutureMarket[]): CoinalyzeFutureMarket[] {
  return markets
    .filter((market) => market.baseAsset.toUpperCase() === "BTC" && market.isPerpetual && market.expireAt === 0)
    .sort((left, right) => left.symbol.localeCompare(right.symbol));
}

export async function fetchCoinalyzeFutureMarkets(
  dependencies: Dependencies = {},
): Promise<ProviderResult<CoinalyzeFutureMarket>> {
  const key = apiKey(dependencies);
  const now = dependencies.now ?? (() => new Date());
  if (!key) {
    return providerResult(COINALYZE_SOURCE_ID, "UNAVAILABLE", [], "COINALYZE_API_KEY is not configured", undefined, now().toISOString());
  }
  const fetcher = dependencies.fetch ?? fetch;
  try {
    const response = await fetcher(`${COINALYZE_BASE_URL}/future-markets`, {
      headers: { accept: "application/json", api_key: key },
      ...providerFetchPolicy("FRESH", 300),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = await responseJson(response, "Coinalyze future-markets");
    const data = parseFutureMarkets(payload);
    const retrievedAt = now().toISOString();
    return providerResult(
      COINALYZE_SOURCE_ID,
      data.length > 0 ? "SUCCESS" : "EMPTY",
      data,
      data.length > 0 ? undefined : "Coinalyze returned no future markets",
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = now().toISOString();
    return providerResult(COINALYZE_SOURCE_ID, "ERROR", [], credentialSafeMessage(error, key), undefined, retrievedAt);
  }
}

async function fetchHistory<T>(
  endpoint: string,
  kind: HistoryKind,
  query: CoinalyzeHistoryQuery,
  parsePoint: (candidate: unknown, label: string) => T,
  convertToUsd: boolean,
  dependencies: Dependencies,
): Promise<ProviderResult<CoinalyzeHistorySeries<T>>> {
  const now = dependencies.now ?? (() => new Date());
  let symbols: string[];
  try {
    symbols = validateHistoryQuery(query);
  } catch (error) {
    return providerResult(
      COINALYZE_SOURCE_ID,
      "ERROR",
      [],
      error instanceof Error ? error.message : "Coinalyze history query is invalid",
      undefined,
      now().toISOString(),
    );
  }
  const key = apiKey(dependencies);
  if (!key) {
    return providerResult(COINALYZE_SOURCE_ID, "UNAVAILABLE", [], "COINALYZE_API_KEY is not configured", undefined, now().toISOString());
  }
  const fetcher = dependencies.fetch ?? fetch;
  const output: CoinalyzeHistorySeries<T>[] = [];
  try {
    for (const symbolChunk of chunks(symbols, COINALYZE_MAX_SYMBOLS_PER_REQUEST)) {
      const url = new URL(`${COINALYZE_BASE_URL}/${endpoint}`);
      url.searchParams.set("symbols", symbolChunk.join(","));
      url.searchParams.set("interval", COINALYZE_INTERVAL);
      url.searchParams.set("from", String(query.from));
      url.searchParams.set("to", String(query.to));
      if (convertToUsd) url.searchParams.set("convert_to_usd", "true");
      const response = await fetcher(url.toString(), {
        headers: { accept: "application/json", api_key: key },
        ...providerFetchPolicy(query.acquisitionMode ?? "FRESH", 300),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = await responseJson(response, `Coinalyze ${kind}`);
      output.push(...parseHistoryPayload(payload, symbolChunk, kind, parsePoint));
    }
    const retrievedAt = now().toISOString();
    return providerResult(
      COINALYZE_SOURCE_ID,
      output.length > 0 ? "SUCCESS" : "EMPTY",
      output,
      output.length > 0 ? undefined : `Coinalyze returned no ${kind} history`,
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = now().toISOString();
    return providerResult(COINALYZE_SOURCE_ID, "ERROR", [], credentialSafeMessage(error, key), undefined, retrievedAt);
  }
}

export function fetchCoinalyzeOpenInterestHistory(
  query: CoinalyzeHistoryQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcPoint>>> {
  return fetchHistory(
    "open-interest-history",
    "open-interest",
    query,
    (candidate, label) => parseOhlcRow(candidate, label),
    true,
    dependencies,
  );
}

export function fetchCoinalyzeFundingRateHistory(
  query: CoinalyzeHistoryQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcPoint>>> {
  return fetchHistory(
    "funding-rate-history",
    "funding-rate",
    query,
    (candidate, label) => parseOhlcRow(candidate, label, true),
    false,
    dependencies,
  );
}

export function fetchCoinalyzeLiquidationHistory(
  query: CoinalyzeHistoryQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<CoinalyzeHistorySeries<CoinalyzeLiquidationPoint>>> {
  return fetchHistory(
    "liquidation-history",
    "liquidation",
    query,
    parseLiquidationRow,
    true,
    dependencies,
  );
}

export function fetchCoinalyzeOhlcvHistory(
  query: CoinalyzeHistoryQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<CoinalyzeHistorySeries<CoinalyzeOhlcvPoint>>> {
  return fetchHistory(
    "ohlcv-history",
    "ohlcv",
    query,
    parseOhlcvRow,
    false,
    dependencies,
  );
}
