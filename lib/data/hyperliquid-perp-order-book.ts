import "server-only";

import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const HYPERLIQUID_PERP_ORDER_BOOK_SOURCE_ID = "hyperliquid" as const;
export const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info" as const;
export const HYPERLIQUID_BTC_COIN = "BTC" as const;
export const HYPERLIQUID_MAX_LEVELS_PER_SIDE = 20;

const REQUEST_TIMEOUT_MS = 10_000;

export type HyperliquidPerpOrderBookLevel = {
  price: number;
  quantityBtc: number;
  restingOrderCount: number;
};

export type HyperliquidPerpOrderBookSnapshot = {
  coin: typeof HYPERLIQUID_BTC_COIN;
  providerTimeMs: number;
  bids: HyperliquidPerpOrderBookLevel[];
  asks: HyperliquidPerpOrderBookLevel[];
};

export type HyperliquidPerpOrderBookQuery = {
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
};

function positiveNumber(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Hyperliquid order book malformed payload: ${label} must be a positive number`);
  }
  return parsed;
}

function positiveInteger(value: unknown, label: string): number {
  const parsed = positiveNumber(value, label);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Hyperliquid order book malformed payload: ${label} must be an integer`);
  }
  return parsed;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Hyperliquid order book malformed payload: ${label} must be a non-negative integer`);
  }
  return parsed;
}

function parseLevel(candidate: unknown, label: string): HyperliquidPerpOrderBookLevel {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`Hyperliquid order book malformed payload: ${label} must be an object`);
  }
  const row = candidate as Record<string, unknown>;
  return {
    price: positiveNumber(row.px, `${label}.px`),
    quantityBtc: positiveNumber(row.sz, `${label}.sz`),
    restingOrderCount: positiveInteger(row.n, `${label}.n`),
  };
}

function validateStrictOrder(levels: HyperliquidPerpOrderBookLevel[], side: "BID" | "ASK"): void {
  if (levels.length === 0) {
    throw new Error(`Hyperliquid order book malformed payload: ${side.toLowerCase()} levels must not be empty`);
  }
  if (levels.length > HYPERLIQUID_MAX_LEVELS_PER_SIDE) {
    throw new Error(`Hyperliquid order book malformed payload: ${side.toLowerCase()} exceeds documented 20-level cap`);
  }
  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1].price;
    const current = levels[index].price;
    if (side === "BID" ? previous <= current : previous >= current) {
      throw new Error(
        `Hyperliquid order book malformed payload: ${side.toLowerCase()} prices must be strictly ${side === "BID" ? "descending" : "ascending"}`,
      );
    }
  }
}

function parseSnapshot(payload: unknown): HyperliquidPerpOrderBookSnapshot {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Hyperliquid order book malformed payload: response must be an object");
  }
  const row = payload as Record<string, unknown>;
  if (row.coin !== HYPERLIQUID_BTC_COIN) {
    throw new Error(`Hyperliquid order book malformed payload: expected BTC coin, got ${String(row.coin)}`);
  }
  if (!Array.isArray(row.levels) || row.levels.length !== 2) {
    throw new Error("Hyperliquid order book malformed payload: levels must contain bid and ask arrays");
  }
  const [rawBids, rawAsks] = row.levels;
  if (!Array.isArray(rawBids) || !Array.isArray(rawAsks)) {
    throw new Error("Hyperliquid order book malformed payload: bid/ask levels must be arrays");
  }

  const bids = rawBids.map((level, index) => parseLevel(level, `bids[${index}]`));
  const asks = rawAsks.map((level, index) => parseLevel(level, `asks[${index}]`));
  validateStrictOrder(bids, "BID");
  validateStrictOrder(asks, "ASK");

  if (bids[0].price >= asks[0].price) {
    throw new Error("Hyperliquid order book malformed payload: best bid must be below best ask");
  }

  return {
    coin: HYPERLIQUID_BTC_COIN,
    providerTimeMs: nonNegativeInteger(row.time, "time"),
    bids,
    asks,
  };
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(`Hyperliquid order book HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("Hyperliquid order book invalid JSON response");
  }
}

export async function fetchHyperliquidBtcPerpOrderBook(
  query: HyperliquidPerpOrderBookQuery = {},
  dependencies: Dependencies = {},
): Promise<ProviderResult<HyperliquidPerpOrderBookSnapshot>> {
  const now = dependencies.now ?? (() => new Date());
  try {
    const response = await (dependencies.fetch ?? fetch)(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ type: "l2Book", coin: HYPERLIQUID_BTC_COIN }),
      ...providerFetchPolicy(query.acquisitionMode ?? "FRESH", 5),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = await responseJson(response);
    const snapshot = parseSnapshot(payload);
    const retrievedAt = now().toISOString();
    return providerResult(
      HYPERLIQUID_PERP_ORDER_BOOK_SOURCE_ID,
      "SUCCESS",
      [snapshot],
      undefined,
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = now().toISOString();
    return providerResult(
      HYPERLIQUID_PERP_ORDER_BOOK_SOURCE_ID,
      "ERROR",
      [],
      error instanceof Error ? error.message : "Hyperliquid order book request failed",
      undefined,
      retrievedAt,
    );
  }
}
