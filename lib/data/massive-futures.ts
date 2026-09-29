import "server-only";
import { providerResult, type ProviderResult } from "./types";

const MASSIVE_BASE = "https://api.massive.com";
const PRODUCT_CODE = "ZT";

export type MassiveFuturesContract = {
  ticker: string;
  productCode: string;
  name: string | null;
  lastTradeDate: string | null;
  settlementDate: string | null;
  daysToMaturity: number | null;
  tradingVenue: string | null;
};

export type MassiveFuturesBar = {
  ticker: string;
  windowStart: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
};

type ContractsResponse = {
  status?: string;
  results?: Array<{
    ticker?: string;
    product_code?: string;
    name?: string;
    last_trade_date?: string;
    settlement_date?: string;
    days_to_maturity?: number;
    trading_venue?: string;
    type?: string;
    active?: boolean;
  }>;
};

type AggsResponse = {
  status?: string;
  results?: Array<{
    ticker?: string;
    window_start?: number | string;
    close?: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
  }>;
};

function apiKey(): string | null {
  const value = process.env.MASSIVE_API_KEY?.trim();
  return value || null;
}

async function massiveGet<T>(path: string, params: URLSearchParams): Promise<{ data: T } | { error: string }> {
  const key = apiKey();
  if (!key) return { error: "MASSIVE_API_KEY is not configured" };
  params.set("apiKey", key);
  try {
    const response = await fetch(`${MASSIVE_BASE}${path}?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { error: `Massive HTTP ${response.status}` };
    return { data: await response.json() as T };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Massive request failed" };
  }
}

export async function fetchMassiveZtContracts(date: string): Promise<ProviderResult<MassiveFuturesContract>> {
  const params = new URLSearchParams({
    date,
    product_code: PRODUCT_CODE,
    active: "true",
    type: "single",
    limit: "100",
    sort: "last_trade_date.asc",
  });
  const response = await massiveGet<ContractsResponse>("/futures/v1/contracts", params);
  if ("error" in response) return providerResult("massive", "ERROR", [], response.error);

  const contracts = (response.data.results ?? [])
    .filter((item) => item.product_code === PRODUCT_CODE && item.active !== false && item.type !== "combo" && item.ticker)
    .map((item) => ({
      ticker: item.ticker!,
      productCode: PRODUCT_CODE,
      name: item.name ?? null,
      lastTradeDate: item.last_trade_date ?? null,
      settlementDate: item.settlement_date ?? null,
      daysToMaturity: Number.isFinite(item.days_to_maturity) ? Number(item.days_to_maturity) : null,
      tradingVenue: item.trading_venue ?? null,
    }))
    .sort((a, b) => (a.daysToMaturity ?? Number.MAX_SAFE_INTEGER) - (b.daysToMaturity ?? Number.MAX_SAFE_INTEGER));

  return providerResult("massive", contracts.length ? "SUCCESS" : "EMPTY", contracts);
}

function ns(iso: string): string {
  return (BigInt(new Date(iso).getTime()) * BigInt(1_000_000)).toString();
}

function isoFromNs(value: number | string): string | null {
  try {
    const millis = Number(BigInt(String(value)) / BigInt(1_000_000));
    return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
  } catch {
    return null;
  }
}

export async function fetchMassiveMinuteBars(input: {
  ticker: string;
  from: string;
  to: string;
}): Promise<ProviderResult<MassiveFuturesBar>> {
  const params = new URLSearchParams({
    resolution: "1min",
    "window_start.gte": ns(input.from),
    "window_start.lte": ns(input.to),
    limit: "500",
    sort: "window_start.asc",
  });
  const response = await massiveGet<AggsResponse>(`/futures/v1/aggs/${encodeURIComponent(input.ticker)}`, params);
  if ("error" in response) return providerResult("massive", "ERROR", [], response.error);

  const bars = (response.data.results ?? []).flatMap((item) => {
    const at = item.window_start === undefined ? null : isoFromNs(item.window_start);
    if (!at || !Number.isFinite(item.close)) return [];
    return [{
      ticker: item.ticker ?? input.ticker,
      windowStart: at,
      close: Number(item.close),
      open: Number.isFinite(item.open) ? Number(item.open) : null,
      high: Number.isFinite(item.high) ? Number(item.high) : null,
      low: Number.isFinite(item.low) ? Number(item.low) : null,
      volume: Number.isFinite(item.volume) ? Number(item.volume) : null,
    }];
  });

  return providerResult("massive", bars.length ? "SUCCESS" : "EMPTY", bars);
}
