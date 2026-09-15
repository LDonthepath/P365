import "server-only";
import type { NewsItem, ProviderResult } from "./types";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

type AlphaVantageFeedItem = {
  title: string;
  url: string;
  time_published: string;
  summary: string;
  source: string;
  topics?: { topic: string }[];
};

function parseAlphaVantageTime(raw: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const value = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

async function fetchAlphaVantageFeed(params: Record<string, string>): Promise<ProviderResult<AlphaVantageFeedItem>> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return { status: "UNAVAILABLE", data: [], message: "ALPHA_VANTAGE_API_KEY is not configured" };

  const url = new URL(ALPHA_VANTAGE_BASE);
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("apikey", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 1800, tags: ["p365-dashboard"] }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { status: "ERROR", data: [], message: `Alpha Vantage HTTP ${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data?.feed)) return { status: "EMPTY", data: [] };
    const feed = data.feed as AlphaVantageFeedItem[];
    return { status: feed.length > 0 ? "SUCCESS" : "EMPTY", data: feed };
  } catch (error) {
    return { status: "ERROR", data: [], message: error instanceof Error ? error.message : "Alpha Vantage request failed" };
  }
}

function toNewsItem(item: AlphaVantageFeedItem, categoryFallback: string): NewsItem | null {
  const publishedAt = parseAlphaVantageTime(item.time_published);
  if (!publishedAt || !item.title?.trim() || !item.url?.trim()) return null;
  return {
    id: item.url,
    category: (item.topics?.[0]?.topic ?? categoryFallback).toUpperCase().replace(/_/g, " "),
    source: item.source,
    publishedAt,
    title: item.title,
    summary: item.summary,
    url: item.url,
  };
}

export async function fetchMacroNews(limit = 6): Promise<ProviderResult<NewsItem>> {
  const result = await fetchAlphaVantageFeed({
    topics: "economy_macro,economy_monetary,economy_fiscal,financial_markets",
    sort: "LATEST",
    limit: String(limit),
  });
  const data = result.data.map((item) => toNewsItem(item, "MACRO")).filter((item): item is NewsItem => item !== null).slice(0, limit);
  return { ...result, status: data.length > 0 ? result.status : result.status === "SUCCESS" ? "EMPTY" : result.status, data };
}

export async function fetchAlphaVantageCryptoNews(limit = 6): Promise<ProviderResult<NewsItem>> {
  const result = await fetchAlphaVantageFeed({
    tickers: "CRYPTO:BTC,CRYPTO:ETH",
    sort: "LATEST",
    limit: String(limit),
  });
  const data = result.data.map((item) => toNewsItem(item, "CRYPTO")).filter((item): item is NewsItem => item !== null).slice(0, limit);
  return { ...result, status: data.length > 0 ? result.status : result.status === "SUCCESS" ? "EMPTY" : result.status, data };
}
