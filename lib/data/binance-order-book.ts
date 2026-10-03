import "server-only";

import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const BINANCE_ORDER_BOOK_SOURCE_ID = "binance-spot" as const;
export const BINANCE_ORDER_BOOK_BASE_URL = "https://data-api.binance.vision/api/v3" as const;
export const BINANCE_ORDER_BOOK_SYMBOL = "BTCUSDT" as const;
export const BINANCE_ORDER_BOOK_DEFAULT_LIMIT = 500;

const REQUEST_TIMEOUT_MS = 10_000;
const ALLOWED_LIMITS = new Set([100, 500, 1000, 5000]);

export type BinanceOrderBookLevel = {
  priceUsdt: number;
  quantityBtc: number;
};

export type BinanceOrderBookSnapshot = {
  symbol: typeof BINANCE_ORDER_BOOK_SYMBOL;
  lastUpdateId: number;
  bids: BinanceOrderBookLevel[];
  asks: BinanceOrderBookLevel[];
};

export type BinanceOrderBookQuery = {
  limit?: 100 | 500 | 1000 | 5000;
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
};

function positiveNumber(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Binance order book malformed payload: ${label} must be a positive number`);
  }
  return parsed;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Binance order book malformed payload: ${label} must be a non-negative integer`);
  }
  return parsed;
}

function parseLevel(candidate: unknown, label: string): BinanceOrderBookLevel {
  if (!Array.isArray(candidate) || candidate.length < 2) {
    throw new Error(`Binance order book malformed payload: ${label} must contain price and quantity`);
  }
  return {
    priceUsdt: positiveNumber(candidate[0], `${label}[0]`),
    quantityBtc: positiveNumber(candidate[1], `${label}[1]`),
  };
}

function validateStrictOrder(levels: BinanceOrderBookLevel[], side: "BID" | "ASK"): void {
  if (levels.length === 0) {
    throw new Error(`Binance order book malformed payload: ${side.toLowerCase()} levels must not be empty`);
  }

  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1].priceUsdt;
    const current = levels[index].priceUsdt;
    if (side === "BID" ? previous <= current : previous >= current) {
      throw new Error(
        `Binance order book malformed payload: ${side.toLowerCase()} prices must be strictly ${side === "BID" ? "descending" : "ascending"}`,
      );
    }
  }
}

function parseSnapshot(payload: unknown): BinanceOrderBookSnapshot {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Binance order book malformed payload: response must be an object");
  }
  const row = payload as Record<string, unknown>;
  if (!Array.isArray(row.bids) || !Array.isArray(row.asks)) {
    throw new Error("Binance order book malformed payload: bids and asks must be arrays");
  }

  const bids = row.bids.map((level, index) => parseLevel(level, `bids[${index}]`));
  const asks = row.asks.map((level, index) => parseLevel(level, `asks[${index}]`));

  validateStrictOrder(bids, "BID");
  validateStrictOrder(asks, "ASK");

  if (bids[0].priceUsdt >= asks[0].priceUsdt) {
    throw new Error("Binance order book malformed payload: best bid must be below best ask");
  }

  return {
    symbol: BINANCE_ORDER_BOOK_SYMBOL,
    lastUpdateId: nonNegativeInteger(row.lastUpdateId, "lastUpdateId"),
    bids,
    asks,
  };
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(`Binance order book HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("Binance order book invalid JSON response");
  }
}

export async function fetchBinanceBtcOrderBook(
  query: BinanceOrderBookQuery = {},
  dependencies: Dependencies = {},
): Promise<ProviderResult<BinanceOrderBookSnapshot>> {
  const now = dependencies.now ?? (() => new Date());
  try {
    const limit = query.limit ?? BINANCE_ORDER_BOOK_DEFAULT_LIMIT;
    if (!ALLOWED_LIMITS.has(limit)) {
      throw new Error("Binance order book limit must be one of 100, 500, 1000, or 5000");
    }

    const url = new URL(`${BINANCE_ORDER_BOOK_BASE_URL}/depth`);
    url.searchParams.set("symbol", BINANCE_ORDER_BOOK_SYMBOL);
    url.searchParams.set("limit", String(limit));

    const response = await (dependencies.fetch ?? fetch)(url.toString(), {
      headers: { accept: "application/json" },
      ...providerFetchPolicy(query.acquisitionMode ?? "FRESH", 15),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = await responseJson(response);
    const snapshot = parseSnapshot(payload);
    const retrievedAt = now().toISOString();

    return providerResult(
      BINANCE_ORDER_BOOK_SOURCE_ID,
      "SUCCESS",
      [snapshot],
      undefined,
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = now().toISOString();
    return providerResult(
      BINANCE_ORDER_BOOK_SOURCE_ID,
      "ERROR",
      [],
      error instanceof Error ? error.message : "Binance order book request failed",
      undefined,
      retrievedAt,
    );
  }
}
