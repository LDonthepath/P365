import "server-only";

import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const BYBIT_SPOT_FLOW_SOURCE_ID = "bybit-spot" as const;
export const BYBIT_SPOT_BASE_URL = "https://api.bybit.com" as const;
export const BYBIT_BTC_SPOT_SYMBOL = "BTCUSDT" as const;
export const BYBIT_SPOT_MAX_RECENT_TRADES = 60;

const REQUEST_TIMEOUT_MS = 10_000;

export type BybitSpotTrade = {
  execId: string;
  symbol: typeof BYBIT_BTC_SPOT_SYMBOL;
  takerSide: "BUY" | "SELL";
  priceUsdt: number;
  baseSizeBtc: number;
  executedAtMs: number;
  isBlockTrade: boolean;
  isRpiTrade: boolean;
  sequence: string | null;
};

export type BybitRecentSpotTradeQuery = {
  limit?: number;
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
};

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Bybit Spot malformed payload: ${label} must be a non-empty string`);
  }
  return value;
}

function positiveNumber(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Bybit Spot malformed payload: ${label} must be a positive number`);
  }
  return parsed;
}

function nonNegativeIntegerString(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Bybit Spot malformed payload: ${label} must be a non-negative integer timestamp`);
  }
  return parsed;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Bybit Spot malformed payload: ${label} must be boolean`);
  }
  return value;
}

function parseTrade(candidate: unknown, index: number): BybitSpotTrade {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`Bybit Spot malformed payload: trade[${index}] must be an object`);
  }
  const row = candidate as Record<string, unknown>;
  const symbol = nonEmptyString(row.symbol, `trade[${index}].symbol`);
  if (symbol !== BYBIT_BTC_SPOT_SYMBOL) {
    throw new Error(`Bybit Spot malformed payload: unexpected symbol ${symbol}`);
  }
  const side = nonEmptyString(row.side, `trade[${index}].side`);
  if (side !== "Buy" && side !== "Sell") {
    throw new Error(`Bybit Spot malformed payload: trade[${index}].side must be Buy or Sell`);
  }

  return {
    execId: nonEmptyString(row.execId, `trade[${index}].execId`),
    symbol: BYBIT_BTC_SPOT_SYMBOL,
    takerSide: side === "Buy" ? "BUY" : "SELL",
    priceUsdt: positiveNumber(row.price, `trade[${index}].price`),
    baseSizeBtc: positiveNumber(row.size, `trade[${index}].size`),
    executedAtMs: nonNegativeIntegerString(row.time, `trade[${index}].time`),
    isBlockTrade: booleanValue(row.isBlockTrade, `trade[${index}].isBlockTrade`),
    isRpiTrade: booleanValue(row.isRPITrade, `trade[${index}].isRPITrade`),
    sequence: typeof row.seq === "string" && row.seq.trim() ? row.seq : null,
  };
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(`Bybit Spot HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("Bybit Spot invalid JSON response");
  }
}

export async function fetchBybitRecentBtcSpotTrades(
  query: BybitRecentSpotTradeQuery = {},
  dependencies: Dependencies = {},
): Promise<ProviderResult<BybitSpotTrade>> {
  const now = dependencies.now ?? (() => new Date());
  try {
    const limit = query.limit ?? BYBIT_SPOT_MAX_RECENT_TRADES;
    if (!Number.isInteger(limit) || limit < 1 || limit > BYBIT_SPOT_MAX_RECENT_TRADES) {
      throw new Error(`Bybit Spot limit must be an integer between 1 and ${BYBIT_SPOT_MAX_RECENT_TRADES}`);
    }

    const url = new URL("/v5/market/recent-trade", BYBIT_SPOT_BASE_URL);
    url.searchParams.set("category", "spot");
    url.searchParams.set("symbol", BYBIT_BTC_SPOT_SYMBOL);
    url.searchParams.set("limit", String(limit));

    const response = await (dependencies.fetch ?? fetch)(url.toString(), {
      headers: { accept: "application/json" },
      ...providerFetchPolicy(query.acquisitionMode ?? "FRESH", 15),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = await responseJson(response);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Bybit Spot malformed payload: response must be an object");
    }

    const envelope = payload as Record<string, unknown>;
    if (envelope.retCode !== 0) {
      throw new Error(
        `Bybit Spot provider error: retCode=${String(envelope.retCode)} retMsg=${String(envelope.retMsg ?? "")}`,
      );
    }
    if (!envelope.result || typeof envelope.result !== "object" || Array.isArray(envelope.result)) {
      throw new Error("Bybit Spot malformed payload: result must be an object");
    }
    const result = envelope.result as Record<string, unknown>;
    if (result.category !== "spot") {
      throw new Error(`Bybit Spot malformed payload: result.category must be spot`);
    }
    if (!Array.isArray(result.list)) {
      throw new Error("Bybit Spot malformed payload: result.list must be an array");
    }

    const trades = result.list.map(parseTrade);
    const seen = new Set<string>();
    for (const trade of trades) {
      if (seen.has(trade.execId)) {
        throw new Error(`Bybit Spot malformed payload: duplicate execId ${trade.execId}`);
      }
      seen.add(trade.execId);
    }
    trades.sort((left, right) =>
      left.executedAtMs - right.executedAtMs || left.execId.localeCompare(right.execId));

    const retrievedAt = now().toISOString();
    return providerResult(
      BYBIT_SPOT_FLOW_SOURCE_ID,
      trades.length > 0 ? "SUCCESS" : "EMPTY",
      trades,
      trades.length > 0 ? undefined : "Bybit Spot returned no recent BTCUSDT trades",
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = now().toISOString();
    return providerResult(
      BYBIT_SPOT_FLOW_SOURCE_ID,
      "ERROR",
      [],
      error instanceof Error ? error.message : "Bybit Spot request failed",
      undefined,
      retrievedAt,
    );
  }
}
