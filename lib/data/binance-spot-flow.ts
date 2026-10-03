import "server-only";

import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const BINANCE_SPOT_FLOW_SOURCE_ID = "binance-spot" as const;
export const BINANCE_SPOT_MARKET_DATA_BASE_URL = "https://data-api.binance.vision/api/v3" as const;
export const BINANCE_BTC_SPOT_SYMBOL = "BTCUSDT" as const;
export const BINANCE_SPOT_FLOW_INTERVAL = "5m" as const;
export const BINANCE_SPOT_FLOW_INTERVAL_MS = 5 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 10_000;

export type BinanceSpotKline = {
  symbol: typeof BINANCE_BTC_SPOT_SYMBOL;
  providerIntervalStartMs: number;
  providerCloseTimeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  baseVolumeBtc: number;
  quoteVolumeUsdt: number;
  tradeCount: number;
  takerBuyBaseVolumeBtc: number;
  takerBuyQuoteVolumeUsdt: number;
};

export type BinanceSpotKlineQuery = {
  startTime?: number;
  endTime?: number;
  limit?: number;
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
};

function finiteNumber(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    throw new Error(`Binance Spot malformed payload: ${label} must be finite numeric`);
  }
  return parsed;
}

function nonNegativeNumber(value: unknown, label: string): number {
  const parsed = finiteNumber(value, label);
  if (parsed < 0) throw new Error(`Binance Spot malformed payload: ${label} must be non-negative`);
  return parsed;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const parsed = nonNegativeNumber(value, label);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Binance Spot malformed payload: ${label} must be an integer`);
  }
  return parsed;
}

function parseKline(candidate: unknown, index: number): BinanceSpotKline {
  if (!Array.isArray(candidate) || candidate.length < 11) {
    throw new Error(`Binance Spot malformed payload: kline[${index}] must contain at least 11 fields`);
  }

  const providerIntervalStartMs = nonNegativeInteger(candidate[0], `kline[${index}][0]`);
  const providerCloseTimeMs = nonNegativeInteger(candidate[6], `kline[${index}][6]`);
  const expectedCloseTimeMs = providerIntervalStartMs + BINANCE_SPOT_FLOW_INTERVAL_MS - 1;

  if (providerCloseTimeMs !== expectedCloseTimeMs) {
    throw new Error(`Binance Spot malformed payload: kline[${index}] close time is incompatible with 5m interval`);
  }

  const open = nonNegativeNumber(candidate[1], `kline[${index}][1]`);
  const high = nonNegativeNumber(candidate[2], `kline[${index}][2]`);
  const low = nonNegativeNumber(candidate[3], `kline[${index}][3]`);
  const close = nonNegativeNumber(candidate[4], `kline[${index}][4]`);
  const baseVolumeBtc = nonNegativeNumber(candidate[5], `kline[${index}][5]`);
  const quoteVolumeUsdt = nonNegativeNumber(candidate[7], `kline[${index}][7]`);
  const tradeCount = nonNegativeInteger(candidate[8], `kline[${index}][8]`);
  const takerBuyBaseVolumeBtc = nonNegativeNumber(candidate[9], `kline[${index}][9]`);
  const takerBuyQuoteVolumeUsdt = nonNegativeNumber(candidate[10], `kline[${index}][10]`);

  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
    throw new Error(`Binance Spot malformed payload: kline[${index}] OHLC bounds are inconsistent`);
  }
  if (takerBuyBaseVolumeBtc > baseVolumeBtc) {
    throw new Error(`Binance Spot malformed payload: kline[${index}] taker-buy base volume exceeds total base volume`);
  }
  if (takerBuyQuoteVolumeUsdt > quoteVolumeUsdt) {
    throw new Error(`Binance Spot malformed payload: kline[${index}] taker-buy quote volume exceeds total quote volume`);
  }

  return {
    symbol: BINANCE_BTC_SPOT_SYMBOL,
    providerIntervalStartMs,
    providerCloseTimeMs,
    open,
    high,
    low,
    close,
    baseVolumeBtc,
    quoteVolumeUsdt,
    tradeCount,
    takerBuyBaseVolumeBtc,
    takerBuyQuoteVolumeUsdt,
  };
}

function validateQuery(query: BinanceSpotKlineQuery): void {
  for (const [label, value] of [["startTime", query.startTime], ["endTime", query.endTime]] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`Binance Spot ${label} must be a non-negative integer millisecond timestamp`);
    }
  }
  if (query.startTime !== undefined && query.endTime !== undefined && query.startTime > query.endTime) {
    throw new Error("Binance Spot startTime must be <= endTime");
  }
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 1000)) {
    throw new Error("Binance Spot limit must be an integer between 1 and 1000");
  }
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(`Binance Spot HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("Binance Spot invalid JSON response");
  }
}

export async function fetchBinanceBtcSpotKlines(
  query: BinanceSpotKlineQuery = {},
  dependencies: Dependencies = {},
): Promise<ProviderResult<BinanceSpotKline>> {
  const now = dependencies.now ?? (() => new Date());
  try {
    validateQuery(query);
    const url = new URL(`${BINANCE_SPOT_MARKET_DATA_BASE_URL}/klines`);
    url.searchParams.set("symbol", BINANCE_BTC_SPOT_SYMBOL);
    url.searchParams.set("interval", BINANCE_SPOT_FLOW_INTERVAL);
    url.searchParams.set("timeZone", "0");
    if (query.startTime !== undefined) url.searchParams.set("startTime", String(query.startTime));
    if (query.endTime !== undefined) url.searchParams.set("endTime", String(query.endTime));
    if (query.limit !== undefined) url.searchParams.set("limit", String(query.limit));

    const response = await (dependencies.fetch ?? fetch)(url.toString(), {
      headers: { accept: "application/json" },
      ...providerFetchPolicy(query.acquisitionMode ?? "FRESH", 60),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = await responseJson(response);
    if (!Array.isArray(payload)) {
      throw new Error("Binance Spot malformed payload: klines response must be an array");
    }

    const retrievedAt = now().toISOString();
    const retrievedAtMs = Date.parse(retrievedAt);
    const parsed = payload.map(parseKline);
    for (let index = 1; index < parsed.length; index += 1) {
      if (parsed[index - 1].providerIntervalStartMs >= parsed[index].providerIntervalStartMs) {
        throw new Error("Binance Spot malformed payload: kline open times must be strictly ascending");
      }
    }

    const completed = parsed.filter(
      (bar) => bar.providerIntervalStartMs + BINANCE_SPOT_FLOW_INTERVAL_MS <= retrievedAtMs,
    );

    return providerResult(
      BINANCE_SPOT_FLOW_SOURCE_ID,
      completed.length > 0 ? "SUCCESS" : "EMPTY",
      completed,
      completed.length > 0 ? undefined : "Binance Spot returned no completed 5m BTCUSDT klines",
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = now().toISOString();
    return providerResult(
      BINANCE_SPOT_FLOW_SOURCE_ID,
      "ERROR",
      [],
      error instanceof Error ? error.message : "Binance Spot request failed",
      undefined,
      retrievedAt,
    );
  }
}
