import "server-only";
import type { NewsItem } from "./types";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

type AlphaVantageFeedItem = {
  title: string;
  url: string;
  time_published: string; // e.g. 20260914T072736
  summary: string;
  source: string;
  topics?: { topic: string }[];
};

function parseAlphaVantageTime(raw: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(raw);
  if (!match) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = match;
  return new Date(
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)),
  ).toISOString();
}

async function fetchAlphaVantageFeed(params: Record<string, string>): Promise<AlphaVantageFeedItem[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  const url = new URL(ALPHA_VANTAGE_BASE);
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("apikey", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  try {
    // Alpha Vantage's free tier has a small daily quota, so cache aggressively.
    const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.feed)) return [];
    return data.feed as AlphaVantageFeedItem[];
  } catch {
    return [];
  }
}

function toNewsItem(item: AlphaVantageFeedItem, categoryFallback: string): NewsItem {
  return {
    id: item.url,
    category: (item.topics?.[0]?.topic ?? categoryFallback).toUpperCase().replace(/_/g, " "),
    source: item.source,
    publishedAt: parseAlphaVantageTime(item.time_published),
    title: item.title,
    summary: item.summary,
    url: item.url,
  };
}

export async function fetchMacroNews(limit = 6): Promise<NewsItem[]> {
  const feed = await fetchAlphaVantageFeed({
    topics: "economy_macro,economy_monetary,economy_fiscal,financial_markets",
    sort: "LATEST",
    limit: String(limit),
  });
  return feed.slice(0, limit).map((item) => toNewsItem(item, "MACRO"));
}

export async function fetchAlphaVantageCryptoNews(limit = 6): Promise<NewsItem[]> {
  const feed = await fetchAlphaVantageFeed({
    tickers: "CRYPTO:BTC,CRYPTO:ETH",
    sort: "LATEST",
    limit: String(limit),
  });
  return feed.slice(0, limit).map((item) => toNewsItem(item, "CRYPTO"));
}
