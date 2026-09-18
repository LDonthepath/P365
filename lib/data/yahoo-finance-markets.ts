import "server-only";
import { providerResult, type ProviderResult } from "./types";
import type { CryptoMarketObservationInput } from "./crypto-market";
import { cacheTagForRevalidate } from "./cache-policy";

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// Yahoo's unofficial chart endpoint has no documented daily quota (community-observed
// ceiling is roughly 2000 req/hour per IP), so cadence here is set by the domain's own
// MARKET_REALTIME freshness policy (15 min STALE threshold, see lib/domain/freshness.ts)
// rather than by a provider quota — unlike the old Alpha Vantage market calls this replaces.
const REVALIDATE_SECONDS = 15 * 60;

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketTime?: number;
        currency?: string;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

type YahooQuote = { price: number; observedAt: string; previousClose: number | null; change: number | null; changePct: number | null };

async function fetchYahooQuote(symbol: string): Promise<{ quote: YahooQuote } | { error: string }> {
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      // Yahoo's unauthenticated chart endpoint occasionally blocks requests with no
      // browser-like User-Agent; this is a defensive header, not an auth credential.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; P365-dashboard/1.0)" },
      next: { revalidate: REVALIDATE_SECONDS, tags: [cacheTagForRevalidate(REVALIDATE_SECONDS)] },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { error: `Yahoo Finance HTTP ${res.status} for ${symbol}` };

    const data = (await res.json()) as YahooChartResponse;
    if (data.chart?.error) return { error: data.chart.error.description ?? `Yahoo Finance chart error for ${symbol}` };

    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const time = meta?.regularMarketTime;
    if (!Number.isFinite(price) || !Number.isFinite(time)) {
      return { error: `Yahoo Finance returned no quote for ${symbol}` };
    }

    const previousCloseRaw = Number.isFinite(meta?.chartPreviousClose) ? Number(meta?.chartPreviousClose) : Number.isFinite(meta?.previousClose) ? Number(meta?.previousClose) : null;
    const change = previousCloseRaw === null ? null : Number(price) - previousCloseRaw;
    const changePct = previousCloseRaw === null || previousCloseRaw === 0 ? null : (change! / previousCloseRaw) * 100;

    return { quote: { price: Number(price), observedAt: new Date(Number(time) * 1000).toISOString(), previousClose: previousCloseRaw, change, changePct } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : `Yahoo Finance request failed for ${symbol}` };
  }
}

async function fetchYahooObservation(
  symbol: string,
  metricId: string,
  metadata: Record<string, string | number | boolean | null>,
): Promise<ProviderResult<CryptoMarketObservationInput>> {
  const result = await fetchYahooQuote(symbol);
  if ("error" in result) return providerResult("yahoo-finance", "ERROR", [], result.error);

  const retrievedAt = new Date().toISOString();
  return providerResult("yahoo-finance", "SUCCESS", [{
    metricId,
    symbol,
    value: result.quote.price,
    observedAt: result.quote.observedAt,
    retrievedAt,
    source: "Yahoo Finance",
    metadata: {
      ...metadata,
      previousClose: result.quote.previousClose,
      change: result.quote.change,
      changePct: result.quote.changePct,
      changeBasis: result.quote.previousClose === null ? null : "previous_close",
    },
  }]);
}

/** COMEX gold front-month futures (GC=F) — a real traded price, not an ETF wrapper. */
export async function fetchGoldFuturesSpot(): Promise<ProviderResult<CryptoMarketObservationInput>> {
  return fetchYahooObservation("GC=F", "gold.futures.usd", {
    metric: "front_month_future",
    unit: "USD",
    endpoint: "v8/finance/chart",
  });
}

/** Real Russell 2000 index value (^RUT) — not the IWM ETF tracking proxy. */
export async function fetchRussell2000Index(): Promise<ProviderResult<CryptoMarketObservationInput>> {
  return fetchYahooObservation("^RUT", "russell2000.index.usd", {
    metric: "index_value",
    unit: "Index",
    endpoint: "v8/finance/chart",
  });
}

/** Real ICE U.S. Dollar Index (DX-Y.NYB) — distinct from FRED's DTWEXBGS broad basket. */
export async function fetchDxyIndex(): Promise<ProviderResult<CryptoMarketObservationInput>> {
  return fetchYahooObservation("DX-Y.NYB", "dxy.index.usd", {
    metric: "index_value",
    unit: "Index",
    endpoint: "v8/finance/chart",
  });
}
